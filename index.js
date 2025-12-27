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

doc.openImage(backgroundPath);

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
const cardWidth = mm(95);
const cardHeight = mm(61.5);
const gutter = 0;
const columns = 3;
const rows = 3;
const totalWidth = cardWidth * columns + gutter * (columns - 1);
const totalHeight = cardHeight * rows + gutter * (rows - 1);
const offsetX = (pageWidth - totalWidth) / 2;
const offsetY = (pageHeight - totalHeight) / 2;

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

const drawCutLines = () => {
  doc.save();
  doc.lineWidth(0.25);
  doc.strokeColor('#888888');

  const tick = mm(4);

  for (let col = 0; col <= columns; col += 1) {
    for (let row = 0; row <= rows; row += 1) {
      const x = offsetX + col * cardWidth;
      const y = offsetY + row * cardHeight;

      const left = col === 0;
      const right = col === columns;
      const top = row === 0;
      const bottom = row === rows;

      const hDir = left ? 1 : -1;
      const vDir = top ? 1 : -1;

      if (top || bottom) {
        doc.moveTo(x, y).lineTo(x + tick * hDir, y);
      }

      if (left || right) {
        doc.moveTo(x, y).lineTo(x, y + tick * vDir);
      }
    }
  }

  for (let col = 1; col < columns; col += 1) {
    const x = offsetX + col * cardWidth;
    doc.moveTo(x, offsetY).lineTo(x, offsetY + tick);
    doc.moveTo(x, offsetY + totalHeight).lineTo(x, offsetY + totalHeight - tick);
  }

  for (let row = 1; row < rows; row += 1) {
    const y = offsetY + row * cardHeight;
    doc.moveTo(offsetX, y).lineTo(offsetX + tick, y);
    doc.moveTo(offsetX + totalWidth, y).lineTo(offsetX + totalWidth - tick, y);
  }

  doc.stroke();
  doc.restore();
};

const cardsPerPage = columns * rows;
const totalCards = Math.ceil(lines.length / 2);
const totalPages = Math.ceil(totalCards / cardsPerPage);

for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
  if (pageIndex > 0) {
    doc.addPage();
  }

  const pageStart = pageIndex * cardsPerPage;
  const pageEnd = Math.min(pageStart + cardsPerPage, totalCards);

  for (let cardIndex = pageStart; cardIndex < pageEnd; cardIndex += 1) {
    const localIndex = cardIndex - pageStart;
    const col = localIndex % columns;
    const row = Math.floor(localIndex / columns);
    const x = offsetX + col * (cardWidth + gutter);
    const y = offsetY + row * (cardHeight + gutter);
    const text1 = lines[cardIndex * 2] || '';
    const text2 = lines[cardIndex * 2 + 1] || '';

    doc.image(backgroundPath, x, y, { width: cardWidth, height: cardHeight });

    doc.save().translate(x, y);
    drawTextInBox(text1, 'black', yellowBox, false, cardWidth * 0.06, 'left');
    drawTextInBox(text2, 'white', blueBox, true, -cardWidth * 0.04, 'left');
    doc.restore();
  }

  drawCutLines();
}

doc.end();

console.log(`PDF generado en: ${outputPath}`);
