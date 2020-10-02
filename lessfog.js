// Import JavaScript modules
import { registerSettings } from './module/settings.js';
import { patchMethod } from './module/patchlib.js';

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
    console.log('lessfog | Initializing lessfog');

    // Register custom module settings
    registerSettings();

    if (isNewerVersion('0.7.3', game.data.version)) {
        /**
         * Adjust the FOW transparency for the GM, and optimize contrast
         * between bright, dim, dark, explored, and unexplored areas.
         */
        SightLayer.prototype._configureChannels = function () {
            // Set up the default channel order and alphas (with no darkness)
            const channels = {
                black: { alpha: game.user.isGM ? game.settings.get("lessfog", "alpha_unexplored") : 1.0 },   // ! Changed line
                explored: { alpha: game.settings.get("lessfog", "alpha_explored") },                         // ! Changed line
                dark: { alpha: game.settings.get("lessfog", "alpha_dark") },                                 // ! Changed line
                dim: { alpha: game.settings.get("lessfog", "alpha_dim") },                                   // ! Changed line
                bright: { alpha: 0.0 }
            };

            // Modify alpha levels for darkness value and compute hex code
            for (let c of Object.values(channels)) {
                c.hex = PIXI.utils.rgb2hex([c.alpha, c.alpha, c.alpha]);
            }
            return channels;
        }
    }
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', function () {

    // Allow the GM to see all tokens.
    let newClass = SightLayer;
    newClass = patchMethod(newClass, "restrictVisibility", 4,
        `t.visible = ( !this.tokenVision && !t.data.hidden ) || t.isVisible;`,
        `t.visible = ( !this.tokenVision && !t.data.hidden ) || ( game.settings.get("lessfog", "reveal_tokens") && game.user.isGM ) || t.isVisible;`);
    if (!newClass) return;
    SightLayer.prototype.restrictVisibility = newClass.prototype.restrictVisibility;
    // Change scaling of soft shadow blur.
    newClass = Canvas;
    newClass = patchMethod(newClass, "pan", 12,
        `this.sight.blurDistance = 20 / (CONFIG.Canvas.maxZoom - Math.round(constrained.scale) + 1);`,
        `this.sight.blurDistance = 12 * constrained.scale;`);
    if (!newClass) return;
    Canvas.prototype.pan = newClass.prototype.pan;
    if (isNewerVersion('0.7.3', game.data.version)) {
        // Increase blur on light tinting.
        newClass = LightingLayer;
        newClass = patchMethod(newClass, "_drawLightingContainer", 13,
            `const bf = new PIXI.filters.BlurFilter(16);`,
            `const bf = new PIXI.filters.BlurFilter(32);`);
        if (!newClass) return;
        LightingLayer.prototype._drawLightingContainer = newClass.prototype._drawLightingContainer;
    } else {
        // Adjust soft shadow blur.
        CONFIG.Canvas.blurStrength = 16;
        let expCol = 1.0 - game.settings.get("lessfog", "alpha_explored");
        canvas.sight._exploredColor = rgbToHex([expCol, expCol, expCol+0.1]);
        // Adjust the FOW transparency for the GM.
        newClass = SightLayer;
        newClass = patchMethod(newClass, "_drawFogContainer", 6,
            `fog.unexplored.beginFill(0x000000, 1.0).drawRect(0, 0, d.width, d.height).endFill();`,
            `fog.unexplored.beginFill(0x000000, game.user.isGM ? game.settings.get("lessfog", "alpha_unexplored") : 1.0).drawRect(0, 0, d.width, d.height).endFill();`);
        if (!newClass) return;
        SightLayer.prototype._drawFogContainer = newClass.prototype._drawFogContainer;
    }
    canvas.draw();

});
