// 엠블럼 원본(정사각형 PNG, 어두운 배경에 밝은 엠블럼)에서 앱 로고와 아이콘을 모두 만든다.
//   node scripts/make-icons.mjs path/to/emblem.png
// 만드는 파일:
//   public/logo.png               원형으로 잘라낸 로고, 바깥은 투명 (헤더, 링크 미리보기)
//   src/app/icon.png              파비콘 (투명 배경 원형)
//   src/app/apple-icon.png        iOS 홈 화면 아이콘. 불투명 검정 배경, 모서리는 iOS가 둥글린다
//   public/icons/icon-192.png     PWA 일반 아이콘 (투명 배경 원형)
//   public/icons/icon-512.png
//   public/icons/icon-512-maskable.png  검정 배경, 안쪽 80% 안전 영역 안에 엠블럼을 두는 마스커블 아이콘
// sharp는 next가 함께 설치하는 패키지라 별도 설치 없이 쓴다.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("사용법: node scripts/make-icons.mjs <엠블럼.png>");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const BACKGROUND = "#000000";

// 엠블럼이 차지하는 원을 찾는다: 배경(어두운 색)이 아닌 픽셀의 경계 상자.
const { data, info } = await sharp(source).flatten({ background: BACKGROUND }).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const brightness = data[i] + data[i + 1] + data[i + 2];
    if (brightness > 150) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) throw new Error("엠블럼을 찾지 못했어요. 배경이 어둡고 엠블럼이 밝은 이미지여야 해요.");

const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
const diameter = Math.max(maxX - minX, maxY - minY) + 1;
console.log(`엠블럼 중심 (${center.x}, ${center.y}), 지름 ${diameter}px`);

/** 엠블럼 지름이 전체 한 변의 ratio 만큼 되도록 정사각형으로 잘라낸다. 원본 밖은 배경색으로 채운다. */
async function cropAround(ratio) {
  const side = Math.round(diameter / ratio);
  const left = Math.round(center.x - side / 2);
  const top = Math.round(center.y - side / 2);
  const pad = Math.max(0, -left, -top, left + side - width, top + side - height);
  let base = sharp(source).flatten({ background: BACKGROUND });
  if (pad > 0) {
    // sharp는 extend를 extract보다 뒤에 적용하므로, 여백은 먼저 별도 버퍼로 만든다.
    base = sharp(await base.extend({ top: pad, bottom: pad, left: pad, right: pad, background: BACKGROUND }).png().toBuffer());
  }
  return base.extract({ left: left + pad, top: top + pad, width: side, height: side });
}

function circleMask(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
}

/** 원형 배지: 엠블럼 둘레에 얇은 배경 여백만 남기고 바깥은 투명. */
async function badge(size) {
  return (await cropAround(0.94))
    .resize(size, size)
    .composite([{ input: circleMask(size), blend: "dest-in" }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

/** 투명 캔버스 가운데에 배지를 scale 크기로 얹는다 (PWA 일반 아이콘). */
async function badgeOnTransparent(size, scale) {
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await badge(Math.round(size * scale)), gravity: "centre" }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

/** 불투명 정사각형 아이콘: 배경을 꽉 채우고 엠블럼 지름은 한 변의 ratio 만큼. */
async function square(size, ratio) {
  return (await cropAround(ratio)).resize(size, size).removeAlpha().png({ compressionLevel: 9, palette: true }).toBuffer();
}

const outputs = [
  ["public/logo.png", await badge(512)],
  ["src/app/icon.png", await badge(128)],
  ["src/app/apple-icon.png", await square(180, 0.85)],
  ["public/icons/icon-192.png", await badgeOnTransparent(192, 0.96)],
  ["public/icons/icon-512.png", await badgeOnTransparent(512, 0.96)],
  ["public/icons/icon-512-maskable.png", await square(512, 0.71)],
];

for (const [file, buffer] of outputs) {
  const path = resolve(root, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  console.log(`썼어요: ${file} (${(buffer.length / 1024).toFixed(1)} KB)`);
}
