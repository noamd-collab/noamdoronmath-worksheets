/* Noam AI: shared reCAPTCHA v3 readiness; fresh tokens per protected action. */
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
    noamImageSolve: "noam_image_solve",
    noamDiagramPlan: "noam_diagram_plan",
    noamSiteCompanion: "noam_site_companion"
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

  function isTransientNetworkError(error) {
    if (!error || isProtectionError(error) ||
        typeof (error.status || error.httpStatus) === "number" ||
        error.code === "REQUEST_TIMEOUT") {
      return false;
    }
    var message = String(error.message || error);
    return error.name === "TypeError" ||
      /failed to fetch|networkerror|network request failed|load failed/i.test(message);
  }

  function validatedChallenge(value) {
    if (!value || value.provider !== "recaptcha-v2" ||
        typeof value.siteKey !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(value.siteKey) ||
        typeof value.requestToken !== "string" || !/^[A-Za-z0-9_.-]{20,8192}$/.test(value.requestToken) ||
        typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) ||
        value.expiresAt <= Date.now() || value.expiresAt > Date.now() + 5 * 60 * 1000) return null;
    return Object.freeze({ provider: value.provider, siteKey: value.siteKey,
      requestToken: value.requestToken, expiresAt: value.expiresAt });
  }

  function responseError(response, data) {
    var detail = data && data.error;
    var message = typeof detail === "string" ? detail : detail && detail.message;
    var code = data && (data.code || data.errorCode || (detail && detail.code));
    var error = makeError(message || "נועם AI לא זמין כרגע. נסו שוב בעוד רגע.",
      code || (data ? "HTTP_ERROR" : "HTTP_ERROR_BODY_UNREADABLE"), response.status);
    if (response.status === 403 && code === "BOT_STEP_UP_REQUIRED") {
      error.challenge = validatedChallenge(data && data.challenge);
    }
    return error;
  }

  // All Noam clients on one page share Google's page-global SDK, but never tokens.
  // Keep this on the window so a second copy of this small client cannot create
  // a competing loader. Only SDK work is queued; model requests are independent.
  function sharedRuntime(win, siteKey) {
    var registry = win.__noamBotRecaptchaRuntime;
    if (!registry || registry.version !== 1) {
      registry = { version: 1, bySiteKey: Object.create(null), queue: Promise.resolve() };
      win.__noamBotRecaptchaRuntime = registry;
    }
    if (!registry.bySiteKey[siteKey]) {
      registry.bySiteKey[siteKey] = {
        registry: registry, scriptPromise: null, loadedHost: "", currentScript: null,
        recaptchaAttempt: 0, discardedRecaptcha: null, loadedApi: null
      };
    }
    return registry.bySiteKey[siteKey];
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
    var networkRetryDelay = typeof options.networkRetryDelayMs === "number" ?
      Math.max(0, options.networkRetryDelayMs) : 650;
    var configPromise = null;
    var RECAPTCHA_HOSTS = [
      "https://www.google.com/recaptcha/api.js?render=",
      "https://www.recaptcha.net/recaptcha/api.js?render="
    ];

    // The deadline covers response parsing too. It still rejects on browsers
    // without AbortController; an expired operation can never send an AI call.
    function timed(operation, milliseconds, timeoutCode, timeoutMessage) {
      var Controller = options.AbortController || win.AbortController;
      var controller = Controller ? new Controller() : null;
      var state = {
        expired: false,
        signal: controller ? controller.signal : undefined,
        deadline: Date.now() + milliseconds
      };
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
      if (state.expired || (state.deadline && Date.now() >= state.deadline)) {
        state.expired = true;
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

    function clearLoadedRecaptcha(runtime) {
      runtime.recaptchaAttempt += 1;
      runtime.scriptPromise = null;
      runtime.loadedHost = "";
      var script = runtime.currentScript;
      runtime.currentScript = null;
      if (script) {
        script.onload = null;
        script.onerror = null;
        if (script.parentNode) { script.parentNode.removeChild(script); }
      }
      var ownedApi = runtime.loadedApi;
      runtime.discardedRecaptcha = ownedApi;
      runtime.loadedApi = null;
      // Never erase a page-global SDK that this loader did not create/use.
      if (ownedApi && win.grecaptcha === ownedApi) {
        try { win.grecaptcha = undefined; } catch (error) {}
        try { delete win.grecaptcha; } catch (error) {
          try { win.grecaptcha = undefined; } catch (ignored) {}
        }
        try { win.___grecaptcha_cfg = undefined; } catch (error) {}
        try { delete win.___grecaptcha_cfg; } catch (error) {}
      }
    }

    function canFallbackHost(error, state) {
      if (state && state.expired) { return false; }
      var code = error && error.code;
      return code !== "NOT_ACTIVE" && code !== "BOT_CONFIG_UNAVAILABLE" &&
        code !== "BOT_VERIFICATION_TIMEOUT" && code !== "BOT_ROUTE_UNSUPPORTED";
    }

    function remainingMs(state) {
      if (!state || state.expired) { return 0; }
      return Math.max(0, (state.deadline || 0) - Date.now());
    }

    function hostBudgetMs(state, isLastHost) {
      var left = remainingMs(state);
      if (left <= 0) { return 0; }
      var slack = 20;
      var usable = left > slack ? left - slack : left;
      if (isLastHost) { return Math.max(20, usable); }
      var cap = Math.max(20, Math.floor(verificationTimeout * 0.4));
      return Math.max(20, Math.min(cap, usable));
    }

    function withHostDeadline(promise, state, isLastHost, runtime) {
      return new Promise(function (resolve, reject) {
        var done = false;
        function fail() {
          if (done || (state && state.expired)) { return; }
          done = true;
          clearLoadedRecaptcha(runtime);
          reject(makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE"));
        }
        var budget = hostBudgetMs(state, isLastHost);
        if (budget <= 0) {
          fail();
          return;
        }
        var timer = setTimeout(fail, budget);
        promise.then(function (value) {
          if (done) { return; }
          done = true;
          clearTimeout(timer);
          resolve(value);
        }, function (error) {
          if (done) { return; }
          done = true;
          clearTimeout(timer);
          reject(error);
        });
      });
    }

    function loadRecaptcha(siteKey, hostPrefix, state, isLastHost, runtime) {
      if (options.loadRecaptcha) { return options.loadRecaptcha(siteKey); }
      hostPrefix = hostPrefix || RECAPTCHA_HOSTS[0];
      if (runtime.scriptPromise && runtime.loadedHost === hostPrefix) { return runtime.scriptPromise; }
      if (runtime.scriptPromise && runtime.loadedHost !== hostPrefix) { clearLoadedRecaptcha(runtime); }
      runtime.loadedHost = hostPrefix;
      var attempt = runtime.recaptchaAttempt;
      var script = null;
      runtime.scriptPromise = new Promise(function (resolve, reject) {
        if (!doc || !doc.head) { reject(makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE")); return; }
        var finished = false;
        function dropScript() {
          if (!script) { return; }
          script.onload = null;
          script.onerror = null;
          if (script.parentNode) { script.parentNode.removeChild(script); }
          if (runtime.currentScript === script) { runtime.currentScript = null; }
        }
        var timer = setTimeout(function () {
          if (finished || attempt !== runtime.recaptchaAttempt) { return; }
          finished = true;
          dropScript();
          reject(makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE"));
        }, hostBudgetMs(state, isLastHost));
        function finish(ok) {
          if (finished || attempt !== runtime.recaptchaAttempt) { return; }
          finished = true;
          clearTimeout(timer);
          if (script) {
            script.onload = null;
            script.onerror = null;
          }
          // api.js can finish before Google's secondary bundle adds execute.
          var api = win.grecaptcha;
          if (ok && api && api !== runtime.discardedRecaptcha && typeof api.ready === "function") {
            runtime.loadedApi = api;
            resolve(api);
            return;
          }
          dropScript();
          reject(makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE"));
        }
        script = doc.createElement("script");
        runtime.currentScript = script;
        script.src = hostPrefix + encodeURIComponent(siteKey);
        script.async = true;
        script.onload = function () { finish(true); };
        script.onerror = function () { finish(false); };
        doc.head.appendChild(script);
      }).catch(function (error) {
        if (attempt === runtime.recaptchaAttempt && runtime.loadedHost === hostPrefix) {
          runtime.scriptPromise = null;
          runtime.loadedHost = "";
        }
        throw error;
      });
      return runtime.scriptPromise;
    }

    function executeRecaptcha(recaptcha, siteKey, action, state, attempt, runtime) {
      return new Promise(function (resolve, reject) {
        Promise.resolve().then(function () {
          if (attempt !== runtime.recaptchaAttempt) {
            return;
          }
          checkActive(state);
          if (typeof recaptcha.execute !== "function") {
            throw makeError(VERIFY_MESSAGE, "BOT_CLIENT_UNAVAILABLE");
          }
          // Send only the public site key and fixed action to Google.
          // Execute once per AI request; tokens are never cached.
          state.stage = "execute";
          return recaptcha.execute(siteKey, { action: action });
        }).then(function (token) {
          if (attempt !== runtime.recaptchaAttempt || (state && state.expired)) {
            return;
          }
          resolve(token);
        }, function (error) {
          if (attempt !== runtime.recaptchaAttempt) { return; }
          reject(error);
        });
      });
    }

    function tokenFromHost(siteKey, action, hostPrefix, state, isLastHost, prepareOnly, runtime) {
      state.stage = "script";
      // Bound script+ready per host. Do not switch hosts after execute starts.
      return withHostDeadline(
        loadRecaptcha(siteKey, hostPrefix, state, isLastHost, runtime).then(function (recaptcha) {
          checkActive(state);
          state.stage = "ready";
          // loadRecaptcha may increment runtime.recaptchaAttempt synchronously on host switch.
          var attempt = runtime.recaptchaAttempt;
          return new Promise(function (resolve) {
            recaptcha.ready(function () {
              if (attempt !== runtime.recaptchaAttempt || (state && state.expired)) {
                return;
              }
              resolve(recaptcha);
            });
          });
        }),
        state,
        isLastHost,
        runtime
      ).then(function (recaptcha) {
        checkActive(state);
        if (prepareOnly) { return true; }
        return executeRecaptcha(recaptcha, siteKey, action, state, runtime.recaptchaAttempt, runtime);
      }).then(function (token) {
        checkActive(state);
        if (prepareOnly) { return true; }
        state.stage = "token";
        if (typeof token !== "string" || !token || token.length > 8192) {
          throw makeError(VERIFY_MESSAGE, "BOT_VERIFICATION_FAILED");
        }
        return token;
      });
    }

    function getVerification(action, prepareOnly) {
      // A new explicit protected action ends an older failed human task. A
      // background prepare never removes the provider's visible error details.
      var registry = win.__noamBotRecaptchaRuntime;
      if (!prepareOnly && registry && typeof registry.failedChallenge === "function") {
        registry.failedChallenge();
      }
      var diagnosticState = null;
      return timed(function (requestState) {
        diagnosticState = requestState;
        requestState.stage = "config";
        return getConfig(requestState).then(function (config) {
          checkActive(requestState);
          var shared = sharedRuntime(win, config.siteKey);
          var queued = shared.registry.queue.then(function () {
            // Waiting for another client must not extend this request's deadline.
            checkActive(requestState);
            var runtime = shared;
            return timed(function () {
              // Callbacks observe the original deadline immediately, even if
              // its timer fires just before the queued operation's timer.
              var state = requestState;
              // Keep a working SDK warm, including the supported fallback host.
              var hosts = RECAPTCHA_HOSTS.slice();
              if (runtime.scriptPromise && hosts.indexOf(runtime.loadedHost) > 0) {
                hosts = [runtime.loadedHost].concat(hosts.filter(function (host) { return host !== runtime.loadedHost; }));
              }
              var hostIndex = 0;
              function attemptHost() {
                checkActive(state);
                var isLastHost = hostIndex >= hosts.length - 1;
                return tokenFromHost(
                  config.siteKey, action, hosts[hostIndex], state, isLastHost, prepareOnly, runtime
                ).catch(function (error) {
                  if (!canFallbackHost(error, state) || isLastHost) { throw error; }
                  hostIndex += 1;
                  clearLoadedRecaptcha(runtime);
                  return attemptHost();
                });
              }
              return attemptHost().then(function (token) {
                return prepareOnly ? true : { provider: "recaptcha-v3", token: token };
              });
            }, remainingMs(requestState), "BOT_VERIFICATION_TIMEOUT", VERIFY_MESSAGE).catch(function (error) {
              // This operation still owns the shared SDK queue. A config/queue
              // timeout in a different client never runs this cleanup.
              // A rejected execute can be an untyped Google error. Do not
              // retain that failed SDK as the preferred host for the next action.
              clearLoadedRecaptcha(runtime);
              throw error;
            });
          });
          // Always release the queue, including when Google is unavailable.
          shared.registry.queue = queued.then(function () {}, function () {});
          return queued;
        });
      }, verificationTimeout, "BOT_VERIFICATION_TIMEOUT", VERIFY_MESSAGE).catch(function (error) {
        // A config fetch may ignore abort. A later user action can fetch again.
        if (error && error.code === "BOT_VERIFICATION_TIMEOUT") { configPromise = null; }
        // Trace where verification stopped without logging Google's exception,
        // the public key, the response token, or any worksheet/chat content.
        if (win.console && typeof win.console.warn === "function") {
          var code = error && error.code;
          var knownCodes = ["BOT_CONFIG_UNAVAILABLE", "BOT_CLIENT_UNAVAILABLE",
            "BOT_VERIFICATION_TIMEOUT", "BOT_VERIFICATION_FAILED", "NOT_ACTIVE"];
          win.console.warn("NOAM_VERIFICATION_FAILED", JSON.stringify({
            action: action,
            stage: diagnosticState ? diagnosticState.stage : "config",
            code: knownCodes.indexOf(code) >= 0 ? code : "BOT_VERIFICATION_FAILED"
          }));
        }
        if (isProtectionError(error) || (error && error.code === "NOT_ACTIVE")) { throw error; }
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
        // Only fixed route and bounded machine codes: never log payloads or tokens.
        if (win.console && typeof win.console.warn === "function") {
          var route = String(endpoint || "").split("/").pop();
          var code = String(error && error.code || "UNKNOWN");
          win.console.warn("NOAM_REQUEST_FAILED", JSON.stringify({
            route: Object.prototype.hasOwnProperty.call(ACTIONS, route) ? route : "unknown",
            status: typeof responseStatus === "number" ? responseStatus : null,
            code: /^[A-Z0-9_]{1,80}$/.test(code) ? code : "UNKNOWN"
          }));
        }
        throw error;
      });
    }

    // Explicit v2 rendering uses the same ready SDK as v3. Keep its queue lease
    // until reset so another client cannot discard the SDK during a human task.
    // Google contract: https://developers.google.com/recaptcha/docs/display
    function completeChallenge(challenge, container, challengeOptions) {
      var proof = validatedChallenge(challenge);
      if (!enabled || !proof || !container) {
        return Promise.reject(makeError("אימות האבטחה פג. אפשר לבקש שוב.", "BOT_CHALLENGE_EXPIRED"));
      }
      var signal = challengeOptions && challengeOptions.signal;
      var previousRegistry = win.__noamBotRecaptchaRuntime;
      if ((!signal || !signal.aborted) && previousRegistry && typeof previousRegistry.failedChallenge === "function") {
        previousRegistry.failedChallenge();
      }
      var finished = false, disposed = false, retained = false, widgetApi = null, widgetId = null, expiryTimer, widgetRegistry = null;
      var resolveDone, rejectDone;
      var done = new Promise(function (resolve, reject) { resolveDone = resolve; rejectDone = reject; });
      var releaseLease;
      var lease = new Promise(function (resolve) { releaseLease = resolve; });
      function resetWidget() {
        if (widgetApi && widgetId !== null) {
          var id = widgetId; widgetId = null;
          try { widgetApi.reset(id); } catch (ignored) {}
        }
      }
      function dispose() {
        if (disposed) return;
        disposed = true;
        if (signal) signal.removeEventListener("abort", cancel);
        resetWidget();
        if (widgetRegistry && widgetRegistry.failedChallenge === dispose) delete widgetRegistry.failedChallenge;
        releaseLease();
        // UI cleanup is best effort and cannot retain the lease or reset twice.
        if (retained && challengeOptions && typeof challengeOptions.onDispose === "function") {
          try { challengeOptions.onDispose(); } catch (ignored) {}
        }
      }
      function finish(error, token, keepWidget) {
        if (finished) return;
        finished = true;
        clearTimeout(expiryTimer);
        retained = keepWidget === true;
        if (retained && widgetRegistry) widgetRegistry.failedChallenge = dispose;
        else dispose();
        if (error) rejectDone(error); else resolveDone(token);
      }
      function cancel() {
        if (finished) dispose();
        else finish(makeError("האימות בוטל. הבחירה שלכם נשמרה.", "BOT_CHALLENGE_CANCELLED"));
      }
      expiryTimer = setTimeout(function () {
        finish(makeError("אימות האבטחה פג. אפשר לבקש שוב.", "BOT_CHALLENGE_EXPIRED"));
      }, Math.max(1, proof.expiresAt - Date.now()));
      if (signal) {
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
      }
      if (!finished) timed(getConfig, verificationTimeout, "BOT_VERIFICATION_TIMEOUT", VERIFY_MESSAGE).then(function (config) {
        if (finished) return;
        var runtime = sharedRuntime(win, config.siteKey);
        widgetRegistry = runtime.registry;
        var queued = runtime.registry.queue.then(function () {
          if (finished) return;
          var ready = timed(function (state) {
            return loadRecaptcha(config.siteKey, runtime.loadedHost || RECAPTCHA_HOSTS[0], state, true, runtime).then(function (api) {
              return new Promise(function (resolve, reject) {
                api.ready(function () {
                  try { checkActive(state); resolve(api); } catch (error) { reject(error); }
                });
              });
            });
          }, verificationTimeout, "BOT_VERIFICATION_TIMEOUT", VERIFY_MESSAGE);
          return ready.then(function (api) {
            if (finished) return;
            if (typeof api.render !== "function" || typeof api.reset !== "function") {
              throw makeError("אימות האבטחה לא נטען. אפשר לנסות שוב.", "BOT_CHALLENGE_UNAVAILABLE");
            }
            widgetApi = api;
            widgetId = api.render(container, {
              sitekey: proof.siteKey, size: win.innerWidth && win.innerWidth < 400 ? "compact" : "normal", tabindex: 0,
              callback: function (token) {
                if (proof.expiresAt <= Date.now()) {
                  finish(makeError("אימות האבטחה פג. אפשר לבקש שוב.", "BOT_CHALLENGE_EXPIRED"));
                } else if (typeof token !== "string" || !token || token.length > 8192) {
                  finish(makeError(VERIFY_MESSAGE, "BOT_VERIFICATION_FAILED"));
                } else finish(null, token);
              },
              "expired-callback": function () { finish(makeError("אימות האבטחה פג. אפשר לבקש שוב.", "BOT_CHALLENGE_EXPIRED")); },
              "error-callback": function () { finish(makeError("בדיקת האבטחה של Google לא נטענה. הבחירה שלכם נשמרה.", "BOT_CHALLENGE_UNAVAILABLE"), null, true); }
            });
            if (disposed) resetWidget();
          }).catch(function (error) { finish(error); }).then(function () { return lease; });
        });
        runtime.registry.queue = queued.then(function () {}, function () {});
        return queued;
      }).catch(function (error) { finish(error); });
      return done;
    }

    function postJson(endpoint, payload, requestOptions) {
      var route = typeof endpoint === "string" ? endpoint.slice(api.length + 1) : "";
      var action = typeof endpoint === "string" && endpoint.indexOf(api + "/") === 0 &&
        Object.prototype.hasOwnProperty.call(ACTIONS, route) && ACTIONS[route];
      // Retired/unknown routes stay unavailable even before bot enforcement.
      if (!action) { return Promise.reject(makeError(VERIFY_MESSAGE, "BOT_ROUTE_UNSUPPORTED")); }
      var onChallenge = requestOptions && requestOptions.onChallenge;
      // A later UI edit cannot change the server-ticket-bound request.
      var captured = typeof onChallenge === "function" ? JSON.parse(JSON.stringify(payload)) : payload;
      function attempt() {
        if (!enabled) { return send(endpoint, captured); }
        return getVerification(action).then(function (verification) {
          var body = Object.assign({}, captured, { botVerification: verification });
          // Every attempt receives a fresh single-use verification token.
          return send(endpoint, body);
        });
      }
      return attempt().catch(function (error) {
        if (!isTransientNetworkError(error)) { throw error; }
        return new Promise(function (resolve) {
          setTimeout(resolve, networkRetryDelay);
        }).then(attempt).catch(function (retryError) {
          if (!isTransientNetworkError(retryError)) { throw retryError; }
          throw makeError("החיבור לנועם AI נקטע. בדקו את החיבור ונסו שוב בעוד רגע.",
            "NETWORK_UNAVAILABLE");
        });
      }).catch(function (error) {
        if (!enabled || !error || error.status !== 403 || error.code !== "BOT_STEP_UP_REQUIRED" ||
            typeof onChallenge !== "function" || !validatedChallenge(error.challenge)) throw error;
        var challenge = error.challenge;
        return Promise.resolve().then(function () { return onChallenge(challenge); }).then(function (token) {
          if (!validatedChallenge(challenge)) throw makeError("אימות האבטחה פג. אפשר לבקש שוב.", "BOT_CHALLENGE_EXPIRED");
          if (typeof token !== "string" || !token || token.length > 8192) throw makeError(VERIFY_MESSAGE, "BOT_VERIFICATION_FAILED");
          // One human response, one same-payload POST. This branch never retries
          // a rejection/network error or obtains another v3 token automatically.
          return send(endpoint, Object.assign({}, captured, { botVerification: {
            provider: "recaptcha-v2", token: token, requestToken: challenge.requestToken
          } }));
        });
      });
    }

    function prepare() {
      if (!enabled) { return Promise.resolve(false); }
      // Load public config and wait for the shared SDK only. Tokens stay tied
      // to an explicit protected action and are never pre-generated or cached.
      return getVerification("prepare", true);
    }

    return { postJson: postJson, prepare: prepare, completeChallenge: completeChallenge };
  }

  return {
    version: "20261030-stepup-error-detail",
    create: create,
    isProtectionError: isProtectionError,
    isTransientNetworkError: isTransientNetworkError
  };
}));
