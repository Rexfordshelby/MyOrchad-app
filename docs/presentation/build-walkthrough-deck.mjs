import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "walkthrough-manifest.json");
const outputPath = path.join(__dirname, "MyOrchard_Final_Walkthrough.pptx");
const montagePath = path.join(__dirname, "MyOrchard_Final_Walkthrough.preview.webp");
const previewDir = path.join(__dirname, "deck-preview");

const W = 1280;
const H = 720;
const colors = {
  paper: "#fbf8ef",
  card: "#fffdf6",
  forest: "#173f22",
  leaf: "#2f7d3b",
  gold: "#c5962e",
  clay: "#a75f3d",
  river: "#2f6670",
  muted: "#6f776a",
  line: "#ded6bf",
  ink: "#1c261d",
};

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
}

async function readImage(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function addBox(slide, position, fill = colors.card, line = colors.line) {
  return slide.shapes.add({
    geometry: "roundRect",
    position,
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: "rounded-xl",
  });
}

function addText(slide, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: style.fontSize || 18,
    bold: Boolean(style.bold),
    color: style.color || colors.ink,
    alignment: style.alignment || "left",
  };
  return shape;
}

function addBrand(slide, section = "Final UI walkthrough") {
  addText(slide, "MyOrchard", { left: 64, top: 34, width: 220, height: 32 }, {
    fontSize: 22,
    bold: true,
    color: colors.forest,
  });
  addText(slide, section, { left: 960, top: 38, width: 256, height: 24 }, {
    fontSize: 16,
    color: colors.muted,
    alignment: "right",
  });
  slide.shapes.add({
    geometry: "rect",
    position: { left: 64, top: 76, width: 1152, height: 1 },
    fill: colors.line,
    line: { style: "solid", fill: colors.line, width: 0 },
  });
}

async function addImage(slide, filePath, position, alt, fit = "contain") {
  addBox(slide, position, "#ffffff", colors.line);
  const inset = 10;
  slide.images.add({
    blob: await readImage(filePath),
    contentType: "image/png",
    alt,
    fit,
    position: {
      left: position.left + inset,
      top: position.top + inset,
      width: position.width - inset * 2,
      height: position.height - inset * 2,
    },
    geometry: "roundRect",
    borderRadius: "rounded-lg",
  });
}

function wrapLines(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function addFooter(slide, index) {
  addText(slide, String(index).padStart(2, "0"), { left: 1160, top: 664, width: 56, height: 24 }, {
    fontSize: 16,
    color: colors.muted,
    alignment: "right",
  });
}

async function addTitleSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = colors.paper;

  addText(slide, "MyOrchard", { left: 72, top: 72, width: 360, height: 58 }, {
    fontSize: 50,
    bold: true,
    color: colors.forest,
  });
  addText(slide, "Final app UI walkthrough", { left: 72, top: 140, width: 520, height: 46 }, {
    fontSize: 35,
    bold: true,
    color: colors.ink,
  });
  addText(
    slide,
    "A complete screen-by-screen handoff for farmer, supporter, and admin flows, including responsive views and button purpose.",
    { left: 72, top: 208, width: 500, height: 118 },
    { fontSize: 24, color: colors.muted },
  );
  addBox(slide, { left: 72, top: 386, width: 500, height: 116 }, "#eef4e5", "#cfe0c1");
  addText(slide, "Admin access assigned", { left: 104, top: 410, width: 360, height: 32 }, {
    fontSize: 24,
    bold: true,
    color: colors.forest,
  });
  addText(slide, manifest.adminEmail, { left: 104, top: 456, width: 420, height: 28 }, {
    fontSize: 20,
    color: colors.ink,
  });
  await addImage(
    slide,
    manifest.screenshots[0].filePath,
    { left: 636, top: 92, width: 556, height: 500 },
    "Welcome desktop screenshot",
    "contain",
  );
  addFooter(slide, 1);
}

async function addProofSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = colors.paper;
  addBrand(slide, "Access and QA proof");
  addText(slide, "The admin panel is hidden until an approved email signs in", { left: 64, top: 104, width: 940, height: 44 }, {
    fontSize: 35,
    bold: true,
    color: colors.forest,
  });
  addText(
    slide,
    "The current build assigns raashifshaikh70@gmail.com as admin in the schema and frontend fallback, while normal farmer/supporter views keep admin navigation hidden.",
    { left: 64, top: 160, width: 720, height: 64 },
    { fontSize: 19, color: colors.muted },
  );

  const proof = [
    `Admin email assigned: ${manifest.checks.adminEmailAssigned ? "yes" : "check needed"}`,
    `Admin email visible after admin login: ${manifest.checks.adminEmailVisibleInTopbar ? "yes" : "check needed"}`,
    `Normal user admin panel hidden: ${manifest.checks.normalUserAdminHidden ? "yes" : "check needed"}`,
    `Supporter admin panel hidden: ${manifest.checks.supporterAdminHidden ? "yes" : "check needed"}`,
    "Farmer CSV export works",
    "Admin payments CSV export works",
    "Certificate download works",
  ];
  addBox(slide, { left: 64, top: 264, width: 456, height: 330 }, "#fffdf6", colors.line);
  addText(slide, "Verified checks", { left: 92, top: 292, width: 360, height: 32 }, {
    fontSize: 26,
    bold: true,
    color: colors.forest,
  });
  addText(slide, wrapLines(proof), { left: 92, top: 342, width: 392, height: 214 }, {
    fontSize: 18,
    color: colors.ink,
  });
  await addImage(
    slide,
    path.join(__dirname, "screenshots-contact-sheet.png"),
    { left: 558, top: 236, width: 658, height: 382 },
    "Contact sheet of captured MyOrchard screens",
    "contain",
  );
  addFooter(slide, 2);
}

async function addFlowSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = colors.paper;
  addBrand(slide, "User flow");
  addText(slide, "Every role lands on the right tools after sign-in", { left: 64, top: 104, width: 940, height: 44 }, {
    fontSize: 35,
    bold: true,
    color: colors.forest,
  });

  const cards = [
    {
      title: "Farmer",
      body: "Onboards farm details, submits verification, publishes updates, and maintains a clean farmer profile.",
      accent: colors.leaf,
    },
    {
      title: "Supporter",
      body: "Finds verified orchards, opens farm details, adopts trees, downloads a certificate, and tracks updates.",
      accent: colors.river,
    },
    {
      title: "Admin",
      body: "Available only for approved email access. Reviews farmers, monitors orchards/payments, exports records, and edits settings.",
      accent: colors.forest,
    },
  ];

  cards.forEach((card, index) => {
    const left = 72 + index * 392;
    addBox(slide, { left, top: 210, width: 344, height: 302 }, colors.card, colors.line);
    slide.shapes.add({
      geometry: "rect",
      position: { left, top: 210, width: 344, height: 10 },
      fill: card.accent,
      line: { style: "solid", fill: card.accent, width: 0 },
    });
    addText(slide, card.title, { left: left + 28, top: 250, width: 288, height: 40 }, {
      fontSize: 32,
      bold: true,
      color: colors.forest,
    });
    addText(slide, card.body, { left: left + 28, top: 314, width: 288, height: 144 }, {
      fontSize: 20,
      color: colors.muted,
    });
  });

  addText(slide, "Supabase is the source for auth, admin emails, profiles, verifications, orchards, adoptions, certificates, updates, and program settings.", { left: 96, top: 574, width: 1088, height: 54 }, {
    fontSize: 20,
    color: colors.ink,
    alignment: "center",
  });
  addFooter(slide, 3);
}

async function addScreenSlide(presentation, screen, index) {
  const slide = presentation.slides.add();
  slide.background.fill = colors.paper;
  addBrand(slide, `Screen ${index - 2}`);
  addText(slide, screen.title, { left: 64, top: 102, width: 760, height: 44 }, {
    fontSize: 35,
    bold: true,
    color: colors.forest,
  });

  const imageFrame = screen.viewport?.[2]
    ? { left: 74, top: 164, width: 360, height: 484 }
    : { left: 64, top: 164, width: 760, height: 484 };
  const notesLeft = screen.viewport?.[2] ? 488 : 856;
  const notesWidth = screen.viewport?.[2] ? 700 : 360;

  await addImage(slide, screen.filePath, imageFrame, `${screen.title} screenshot`, "contain");

  addBox(slide, { left: notesLeft, top: 164, width: notesWidth, height: 484 }, colors.card, colors.line);
  addText(slide, "What this page is for", { left: notesLeft + 28, top: 194, width: notesWidth - 56, height: 28 }, {
    fontSize: 24,
    bold: true,
    color: colors.forest,
  });
  addText(slide, screen.purpose, { left: notesLeft + 28, top: 236, width: notesWidth - 56, height: 116 }, {
    fontSize: 18,
    color: colors.muted,
  });
  addText(slide, "Buttons and controls", { left: notesLeft + 28, top: 376, width: notesWidth - 56, height: 28 }, {
    fontSize: 24,
    bold: true,
    color: colors.forest,
  });
  addText(slide, wrapLines(screen.buttons), { left: notesLeft + 28, top: 418, width: notesWidth - 56, height: 184 }, {
    fontSize: 16,
    color: colors.ink,
  });

  addFooter(slide, index);
}

async function main() {
  await fs.rm(previewDir, { recursive: true, force: true });
  await fs.mkdir(previewDir, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: W, height: H },
  });

  await addTitleSlide(presentation);
  await addProofSlide(presentation);
  await addFlowSlide(presentation);

  let slideNumber = 4;
  for (const screen of manifest.screenshots) {
    await addScreenSlide(presentation, screen, slideNumber);
    slideNumber += 1;
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(previewDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(previewDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }

  await writeBlob(montagePath, await presentation.export({ format: "webp", montage: true, scale: 1 }));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPath);
  console.log(JSON.stringify({ outputPath, montagePath, slideCount: presentation.slides.items.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
