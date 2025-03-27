import multer from "multer";
import fs from "fs";
import path from "path";

const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { email, noWA } = req.body;

        if (!email || !noWA) {
            return cb(new Error("Email and WhatsApp number are required for file uploads."), "");
        }

        // Use `path.resolve()` to ensure files are stored in the root `uploads/` directory
        const baseUploadPath = path.resolve("../../../uploads", email, noWA);

        // Determine subdirectory based on file type
        const uploadDir = file.fieldname === "excelFile"
            ? path.join(baseUploadPath, "excelFiles")
            : path.join(baseUploadPath, "images");

        // Ensure the directory exists
        fs.mkdirSync(uploadDir, { recursive: true });

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${file.fieldname}${ext}`); // Unique filename
    }
});

export const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and Excel files are allowed.'));
        }
    }
});