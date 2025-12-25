const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const inputPath = process.argv[2] || path.join(__dirname, 'naipes.txt');
const outputPath = process.argv[3] || path.join(__dirname, 'naipes.pdf');

if (!fs.existsSync(inputPath)) {
  console.error(`No existe el fichero de entrada: ${inputPath}`);
  process.exit(1);
}

const rawBuffer = fs.readFileSync(inputPath);
let raw = rawBuffer.toString('utf8');
if (raw.includes('\uFFFD')) {
  raw = rawBuffer.toString('latin1');
}
const lines = raw.split(/\r?\n/);
if (lines.length && lines[lines.length - 1] === '') {
  lines.pop();
}
for (let i = lines.length - 1; i > 0; i -= 1) {
  const j = Math.floor(Math.random() * (i + 1));
  [lines[i], lines[j]] = [lines[j], lines[i]];
}

const mm = (value) => (value * 72) / 25.4;

const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
doc.pipe(fs.createWriteStream(outputPath));

const backgroundPath = path.join(__dirname, 'background.png');
if (!fs.existsSync(backgroundPath)) {
  console.error(`No existe el fichero de fondo: ${backgroundPath}`);
  process.exit(1);
}

const background = doc.openImage(backgroundPath);
const bgRatio = background.width / background.height;

const funFontCandidates = [
  path.join(__dirname, 'Marker Felt.ttf'),
  '/System/Library/Fonts/Supplemental/PartyLET-plain.ttf',
  '/System/Library/Fonts/Supplemental/Chalkduster.ttf',
  '/System/Library/Fonts/Supplemental/Comic Sans MS.ttf',
];
const funFontPath = funFontCandidates.find((candidate) => fs.existsSync(candidate));
const fontName = funFontPath ? 'FunFont' : 'Helvetica';
if (funFontPath) {
  doc.registerFont(fontName, funFontPath);
}

const pageWidth = doc.page.width;
const pageHeight = doc.page.height;
const margin = mm(10);
const gutter = mm(6);
const columns = 3;
const rows = 3;
const availableWidth = pageWidth - margin * 2;
const availableHeight = pageHeight - margin * 2;
const maxCardWidthByWidth = (availableWidth - gutter * (columns - 1)) / columns;
const maxCardWidthByHeight = ((availableHeight - gutter * (rows - 1)) / rows) * bgRatio;
const cardWidth = Math.min(maxCardWidthByWidth, maxCardWidthByHeight);
const cardHeight = cardWidth / bgRatio;
const totalWidth = cardWidth * columns + gutter * (columns - 1);
const totalHeight = cardHeight * rows + gutter * (rows - 1);
const offsetX = margin + (availableWidth - totalWidth) / 2;
const offsetY = margin + (availableHeight - totalHeight) / 2;

const yellowBox = { x: 0.40, y: 0.14, w: 0.54, h: 0.20 };
const blueBox = { x: -0.02, y: 0.66, w: 0.54, h: 0.20 };

const fitText = (text, width, height, maxSize, minSize) => {
  let size = Math.floor(maxSize);
  for (; size >= minSize; size -= 1) {
    doc.fontSize(size);
    const textHeight = doc.heightOfString(text, { width, align: 'center' });
    if (textHeight <= height) {
      return { size, textHeight };
    }
  }
  doc.fontSize(minSize);
  return { size: minSize, textHeight: doc.heightOfString(text, { width, align: 'center' }) };
};

const drawTextInBox = (text, color, box, rotate, shiftX = 0, align = 'left') => {
  if (!text) {
    return;
  }

  const boxX = box.x * cardWidth;
  const boxY = box.y * cardHeight;
  const boxW = box.w * cardWidth;
  const boxH = box.h * cardHeight;
  const paddingX = boxW * 0.06;
  const paddingY = boxH * 0.12;
  const textX = boxX + paddingX + shiftX;
  const textY = boxY + paddingY;
  const textW = boxW - paddingX * 2 - Math.abs(shiftX);
  const textH = boxH - paddingY * 2;

  if (rotate) {
    const centerX = boxX + boxW / 2;
    const centerY = boxY + boxH / 2;
    doc.save().rotate(180, { origin: [centerX, centerY] });
  }

  doc.font(fontName).fillColor(color);
  const maxSize = textH * 0.75;
  const minSize = 6;
  const { textHeight } = fitText(text, textW, textH, maxSize, minSize);
  const centeredY = textY + (textH - textHeight) / 2;
  doc.text(text, textX, centeredY, { width: textW, align });

  if (rotate) {
    doc.restore();
  }
};

const cardsPerPage = columns * rows;
const totalCards = Math.ceil(lines.length / 2);

for (let cardIndex = 0; cardIndex < totalCards; cardIndex += 1) {
  if (cardIndex > 0 && cardIndex % cardsPerPage === 0) {
    doc.addPage();
  }

  const localIndex = cardIndex % cardsPerPage;
  const col = localIndex % columns;
  const row = Math.floor(localIndex / columns);
  const x = offsetX + col * (cardWidth + gutter);
  const y = offsetY + row * (cardHeight + gutter);
  const text1 = lines[cardIndex * 2] || '';
  const text2 = lines[cardIndex * 2 + 1] || '';

  doc.image(backgroundPath, x, y, { width: cardWidth });

  doc.save().translate(x, y);
  drawTextInBox(text1, 'black', yellowBox, false, cardWidth * 0.06, 'left');
  drawTextInBox(text2, 'white', blueBox, true, -cardWidth * 0.04, 'left');
  doc.restore();
}

doc.end();

console.log(`PDF generado en: ${outputPath}`);
