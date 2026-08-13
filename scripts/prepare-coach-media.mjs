import { mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import sharp from "sharp";

const [zhangSource, haoSource, demoSheetSource] = process.argv.slice(2);
if (!zhangSource || !haoSource || !demoSheetSource) {
  throw new Error("Usage: node scripts/prepare-coach-media.mjs <zhang-photo> <hao-photo> <demo-sheet>");
}

const outputDirectory = resolve("public/images");
await mkdir(outputDirectory, { recursive: true });

async function writeFormats(pipeline, stem) {
  await Promise.all([
    pipeline.clone().webp({ effort: 5, quality: 86 }).toFile(resolve(outputDirectory, `${stem}.webp`)),
    pipeline.clone().avif({ effort: 5, quality: 62 }).toFile(resolve(outputDirectory, `${stem}.avif`)),
  ]);
}

async function preparePortrait(source, slug, heroBackground) {
  const image = sharp(resolve(source), { failOn: "warning" }).rotate();
  await Promise.all([
    writeFormats(image.clone().resize(512, 512, { fit: "cover", position: "attention" }), `coach-${slug}-avatar`),
    writeFormats(image.clone().resize(900, 1125, { fit: "cover", position: "attention" }), `coach-${slug}-card`),
    writeFormats(image.clone().resize(1440, 900, { background: heroBackground, fit: "contain" }), `coach-${slug}-hero`),
  ]);
}

const demoPanels = [
  ["athletics", { height: 483, left: 16, top: 22, width: 491 }],
  ["badminton", { height: 483, left: 520, top: 22, width: 495 }],
  ["swimming", { height: 483, left: 1028, top: 22, width: 492 }],
  ["tennis", { height: 485, left: 16, top: 519, width: 491 }],
  ["basketball", { height: 485, left: 520, top: 519, width: 495 }],
  ["conditioning", { height: 485, left: 1028, top: 519, width: 492 }],
];

await Promise.all([
  preparePortrait(zhangSource, "zhang-zhanqi", "#ffffff"),
  preparePortrait(haoSource, "hao-jianzhuang", "#459cd0"),
  ...demoPanels.map(([slug, crop]) => writeFormats(
    sharp(resolve(demoSheetSource)).extract(crop).resize(1024, 1024, { fit: "cover" }),
    `demo-${slug}`,
  )),
]);

console.log(`Prepared coach media in ${outputDirectory} from ${basename(zhangSource)}, ${basename(haoSource)} and generated demo scenes.`);
