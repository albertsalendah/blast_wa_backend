import fs from "fs";
import path from "path";
import { Request } from "express";
import ExcelJS from "exceljs";
import * as fss from 'fs/promises';

const ensureDirectoryExists = async (dir: string) => {
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
    }
};

export class FileService {
    async handleUploadedFiles(req: Request, email: string, noWA: string) {
        const excelDir = path.join(__dirname, "../../../uploads", email, noWA, "excelFiles");
        const imagesDir = path.join(__dirname, "../../../uploads", email, noWA, "images");

        await ensureDirectoryExists(excelDir);
        await ensureDirectoryExists(imagesDir);

        const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        let excelFileName = "";
        let imageNames: string[] = [];

        if (uploadedFiles) {
            if (uploadedFiles["excelFile"] && uploadedFiles["excelFile"].length > 0) {
                const excelFile = uploadedFiles["excelFile"][0];
                excelFileName = excelFile.originalname;
                fs.renameSync(excelFile.path, path.join(excelDir, excelFile.originalname));
            }

            if (uploadedFiles["images"] && uploadedFiles["images"].length > 0) {
                for (const img of uploadedFiles["images"]) {
                    imageNames.push(img.originalname);
                    fs.renameSync(img.path, path.join(imagesDir, img.originalname));
                }
            }
        }
        return { excelFileName, imageNames };
    }

    public readExcelFile = async (email: string, noWA: string, excelFileName: string): Promise<any[]> => {
        try {
            // Define the file path
            const excelDir = path.join(__dirname, "../../../uploads", email, noWA, "excelFiles");
            const filePath = path.join(excelDir, excelFileName);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`❌ Excel file '${excelFileName}' not found.`);
            }

            console.log(`📂 Reading Excel File: ${filePath}`);

            // Load workbook
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);

            // Get first sheet
            // const worksheet = workbook.worksheets[0];
            // let data: any[] = [];
            // worksheet.eachRow((row, rowNumber) => {
            //     // console.log(`Row ${rowNumber}:`, row.values);
            //     data.push(row.values);
            // });

            const worksheet = workbook.worksheets.map((worksheet) => worksheet);

            // Read rows
            let data: any[] = [];
            for (let sheet of worksheet) {
                sheet.eachRow((row, rowNumber) => {
                    if (rowNumber != 1) {
                        data.push(row.values);
                    }
                });
            }
            const cleanedData = data.map((row: any[]) =>
                row.filter((cell: any) => cell !== undefined && cell !== null && cell !== '')
            );

            return cleanedData;
        } catch (error) {
            console.error("❌ Error reading Excel file:", error);
            throw error;
        }
    };

    public getImages = (email: string, noWA: string, imageNames: string[]): string[] => {
        try {
            // Define the base uploads directory (relative to the public server path)
            const baseUploadPath = "uploads";
            const imagesDir = path.join(baseUploadPath, email, noWA, "images");

            // Check if directory exists
            if (!fs.existsSync(path.join(__dirname, "../../../", imagesDir))) {
                throw new Error(`❌ Images directory not found: ${imagesDir}`);
            }

            let foundImages: string[] = [];

            // Loop through requested image names and check if they exist
            for (const imageName of imageNames) {
                const imagePath = path.join(imagesDir, imageName);
                if (fs.existsSync(path.join(__dirname, "../../../", imagePath))) {
                    foundImages.push(imagePath.replace(/\\/g, "/")); // Ensure Unix-style paths
                } else {
                    console.warn(`⚠️ Image not found: ${imagePath}`);
                }
            }

            return foundImages;
        } catch (error) {
            console.error("❌ Error fetching images:", error);
            throw error;
        }
    };

    async deleteExistingImages(imagePaths: string[]) {
        try {
            for (const imagePath of imagePaths) {
                try {
                    // Check if the file exists
                    await fss.access(imagePath);

                    // If it exists, delete it
                    await fss.unlink(imagePath);
                    console.log(`File deleted: ${imagePath}`);
                } catch (error) {
                    console.error(`Error checking or deleting file: ${imagePath}`, error);
                }
            }
        } catch (error) {
            console.error('Error during image file processing:', error);
        }
    }
}
