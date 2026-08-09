import "./style.css";
import { showHome, showWelcome } from "./shell/app";
import { sdk } from "./sdk/platform";
import { armAudio } from "./engine/sfx";

armAudio(); // unlock WebAudio on the first tap (browser autoplay policy)
sdk.initAds(); // no-op in browser; real AdMob once wrapped as an Android app
// Guest-first: show the one-tap welcome only on the very first launch.
if (sdk.hasProfile()) showHome();
else showWelcome();
