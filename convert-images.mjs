import fs from "fs";
import path from "path";
import sharp from "sharp";

const targetDir = "src/pages";

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (/\.(png|jpg|jpeg)$/i.test(fullPath)) {
      const output = fullPath.replace(/\.(png|jpg|jpeg)$/i, ".webp");

      sharp(fullPath)
        .webp({ quality: 80 })
        .toFile(output)
        .then(() => {
          console.log("Converted:", fullPath);
        })
        .catch((err) => {
          console.error("Error:", fullPath, err);
        });
    }
  }
}

walk(targetDir);