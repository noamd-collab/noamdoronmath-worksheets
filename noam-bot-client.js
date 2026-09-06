/* Noam AI: lazy reCAPTCHA v3 verification. The server makes every trust decision. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NoamBotClient = factory();
  }
}(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var VERIFY_MESSAGE = "לא הצלחנו להשלים את בדיקת האבטחה. נסו שוב בעוד רגע.";
  var ACTIONS = {
    noamImageAnalyze: "noam_image_analyze",
    noamImageSolve: "noam_image_solve"
  };

  function makeError(message, code, status) {
    var error = new Error(message);
    error.code = code;
    if (typeof status === "number") {
      error.status = status;
      error.httpStatus = status;
    }
    return error;
  }

  function isProtectionError(error) {
    var status = error && (error.status || error.httpStatus);
    return !!(error && (/^(BOT_|HTTP_ERROR_BODY_)/.test(String(error.code || "")) ||
      status === 401 || status === 403 || status === 429));
  }

  function responseError(response, data) {
    var detail = data && data.error;
    var message = typeof detail === "string" ? detail : detail && detail.message;
    var code = data && (data.code || data.errorCode || (detail && detail.code));
    return makeError(message || "נועם AI לא זמין כרגע. נסו שוב בעוד רגע.",
      code || (data ? "HTTP_ERROR" : "HTTP_ERROR_BODY_UNREADABLE"), response.status);
  }

  function create(options) {
    options = options || {};
    var win = options.window || (typeof window !== "undefined" ? window : {});
    var doc = options.document || win.document;
    var fetcher = options.fetch || (win.fetch && win.fetch.bind(win));
    var api = String(options.api || "").replace(/\/$/, "");
    var enabled = options.enabled === true;
    var verificationTimeout = options.verificationTimeoutMs || 15000;
    var modelTimeout = options.modelTimeoutMs || 20000;
    var configPromise = null;
    var scriptPromise = null;

    // The deadline covers response parsing too. It still rejects on browsers
    // without AbortController; an expired operation can never send an AI call.
    function timed(operation, milliseconds, timeoutCode, timeoutMessage) {
      var Controller = options.AbortController || win.AbortController;
      var controller = Controller ? new Controller() : null;
      var state = { expired: false, signal: controller ? controller.signal : undefined };
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          state.expired = true;
          reject(makeError(timeoutMessage, timeoutCode));
          if (controller) { controller.abort(); }
        }, milliseconds);
        Promise.resolve().then(function () { return operation(state); }).then(function (value) {
          clearTimeout(timer);
          resolve(value);
        }, function (error) {
          clearTimeout(timer);
          reject(error);
        });
      });
    }

    function checkActive(state) {
      if (state.expired) {
        throw makeError(VERIFY_MESSAGE, "BOT_VERIFICATION_TIMEOUT");
      }
    }

    function getConfig(state) {
      if (!configPromise) {
        configPromise = Promise.resolve().then(function () {
          return fetcher(api + "/noamBotConfig", {
            method: "GET", cache: "no-store", signal: state.signal
          });
        }).then(function (response) {
          if (!response.ok) { throw makeError(VERIFY_MESSAGE, "BOT_CONFIG_UNAVAILABLE", response.status); }
          return response.json();
        }).then(function (config) {
          if (!config || config.ok !== true || config.provider !== "recaptcha-v3" ||
              typeof config.siteKey !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(config.siteKey) ||
              (config.mode !== "observe" && config.mode !== "enforce")) {
            throw makeError(VERIFY_MESSAGE, "BOT_CONFIG_UNAVAILABLE");
          }
          // Keep only the public key. No score or browser flag grants permission.
          return { siteKey: config.siteKey };
        }).catch(function (error) {
          configPromise = null;
          if (isProtectionError(error)) { throw error; }
          throw makeError(VERIFY_MESSAGE, "BOT_CONFIG_UNAVAILABLE");
        });
      }
      return configPromise;
    }

    function loadRecaptcha(siteKey) {
      if (options.loadRecaptcha) { return options.loadRecaptcha(siteKey); }
      if (!scriptPromise) {
        scriptPromise = new Promise(function (resolve, reject) {
          if (!doc || !doc.head) { reject(makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE")); return; }
          var script = doc.createElement("script");
          var timer = setTimeout(function () { finish(false); }, verificationTimeout);
          var finished = false;
          function finish(ok) {
            if (finished) { return; }
            finished = true;
            clearTimeout(timer);
            script.onload = null;
            script.onerror = null;
            // api.js can finish before Google's secondary bundle adds execute.
            // Wait for ready before checking that API, under the same deadline.
            if (ok && win.grecaptcha && typeof win.grecaptcha.ready === "function") {
              resolve(win.grecaptcha);
            } else {
              if (script.parentNode) { script.parentNode.removeChild(script); }
              reject(makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE"));
            }
          }
          script.src = "https://www.google.com/recaptcha/api.js?render=" + encodeURIComponent(siteKey);
          script.async = true;
          script.onload = function () { finish(true); };
          script.onerror = function () { finish(false); };
          doc.head.appendChild(script);
        }).catch(function (error) { scriptPromise = null; throw error; });
      }
      return scriptPromise;
    }

    function getVerification(action) {
      return timed(function (state) {
        return getConfig(state).then(function (config) {
          checkActive(state);
          return Promise.resolve().then(function () { return loadRecaptcha(config.siteKey); })
            .then(function (recaptcha) {
              checkActive(state);
              return new Promise(function (resolve, reject) {
                recaptcha.ready(function () {
                  Promise.resolve().then(function () {
                    checkActive(state);
                    if (typeof recaptcha.execute !== "function") {
                      throw makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE");
                    }
                    // Send only the public site key and fixed action to Google.
                    // Execute once per AI request; tokens are never cached.
                    return recaptcha.execute(config.siteKey, { action: action });
                  }).then(resolve, reject);
                });
              });
            });
        }).then(function (token) {
          checkActive(state);
          if (typeof token !== "string" || !token || token.length > 8192) {
            throw makeError(VERIFY_MESSAGE, "BOT_VERIFICATION_FAILED");
          }
          return { provider: "recaptcha-v3", token: token };
        });
      }, verificationTimeout, "BOT_VERIFICATION_TIMEOUT", VERIFY_MESSAGE).catch(function (error) {
        // A fetch implementation may not honor abort. Allow a later user action
        // to fetch config again instead of retaining an unresolved promise.
        if (error && error.code === "BOT_VERIFICATION_TIMEOUT") { configPromise = null; }
        if (isProtectionError(error)) { throw error; }
        throw makeError(VERIFY_MESSAGE, "BOT_VERIFICATION_FAILED");
      });
    }

    function send(endpoint, payload) {
      var responseStatus = null;
      return timed(function (state) {
        return fetcher(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), signal: state.signal
        }).then(function (response) {
          // Keep denial status even when its body is slow or cannot be parsed.
          responseStatus = response.status;
          return response.json().catch(function () { return null; }).then(function (data) {
            if (!response.ok || (data && data.ok === false)) { throw responseError(response, data); }
            return data;
          });
        });
      }, modelTimeout, "REQUEST_TIMEOUT", "התשובה מתעכבת. נסו שוב בעוד רגע.").catch(function (error) {
        if (error && error.code === "REQUEST_TIMEOUT" && typeof responseStatus === "number") {
          error.status = responseStatus;
          error.httpStatus = responseStatus;
          if (responseStatus >= 400) {
            // An unreadable 503 could itself be the protection service failing.
            // Do not start another paid route when the denial cannot be read.
            error.code = "HTTP_ERROR_BODY_TIMEOUT";
          }
        }
        throw error;
      });
    }

    function postJson(endpoint, payload) {
      var route = typeof endpoint === "string" ? endpoint.slice(api.length + 1) : "";
      var action = typeof endpoint === "string" && endpoint.indexOf(api + "/") === 0 &&
        Object.prototype.hasOwnProperty.call(ACTIONS, route) && ACTIONS[route];
      // Retired/unknown routes stay unavailable even before bot enforcement.
      if (!action) { return Promise.reject(makeError(VERIFY_MESSAGE, "BOT_ROUTE_UNSUPPORTED")); }
      if (!enabled) { return send(endpoint, payload); }
      return getVerification(action).then(function (verification) {
        var body = Object.assign({}, payload, { botVerification: verification });
        // AI timeout starts after the verification finishes. No automatic retry.
        return send(endpoint, body);
      });
    }

    return { postJson: postJson };
  }

  return { create: create, isProtectionError: isProtectionError };
}));
