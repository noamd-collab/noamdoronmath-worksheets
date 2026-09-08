/* Cloud auth is optional: guest learning never waits for the Google SDK. */
(function(){'use strict';var started=false;
 function start(){if(started)return;started=true;var s=document.createElement('script');s.src='noam-learning.js?v=20260908-1';document.body.append(s);}
 if(!window.NOAM_LEARNING_CONFIG||!window.NOAM_LEARNING_CONFIG.googleEnabled||window.self!==window.top){start();return;}
 var sdk=document.createElement('script');sdk.src='vendor/supabase-2.116.0.js';sdk.onload=start;sdk.onerror=start;document.body.append(sdk);setTimeout(start,7000);
})();
