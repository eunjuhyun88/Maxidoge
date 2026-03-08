// Intentionally import the minimal Pixi runtime pieces directly from the installed package
// to avoid pulling the entire `pixi.js` root bundle into the arena-war route chunk.
import '../../../node_modules/pixi.js/lib/rendering/init.mjs';
import '../../../node_modules/pixi.js/lib/app/init.mjs';
import '../../../node_modules/pixi.js/lib/scene/text/init.mjs';
import '../../../node_modules/pixi.js/lib/scene/graphics/init.mjs';

// @ts-expect-error internal Pixi ESM subpath intentionally used for smaller route chunk
export { Application } from '../../../node_modules/pixi.js/lib/app/Application.mjs';
// @ts-expect-error internal Pixi ESM subpath intentionally used for smaller route chunk
export { Container } from '../../../node_modules/pixi.js/lib/scene/container/Container.mjs';
// @ts-expect-error internal Pixi ESM subpath intentionally used for smaller route chunk
export { Graphics } from '../../../node_modules/pixi.js/lib/scene/graphics/shared/Graphics.mjs';
// @ts-expect-error internal Pixi ESM subpath intentionally used for smaller route chunk
export { Text } from '../../../node_modules/pixi.js/lib/scene/text/Text.mjs';
