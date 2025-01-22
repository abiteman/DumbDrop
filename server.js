const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const uploadDir = process.env.UPLOAD_DIR || '/mnt/user/data/media/quickdrop';

// Logging helper
const log = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
    success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`)
};

// Ensure upload directory exists
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        log.info(`Created upload directory: ${uploadDir}`);
    }
} catch (err) {
    log.error(`Failed to create upload directory: ${err.message}`);
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Check if directory is writable
        fs.access(uploadDir, fs.constants.W_OK, (err) => {
            if (err) {
                log.error(`Upload directory not writable: ${err.message}`);
                cb(new Error('Upload directory not writable'));
                return;
            }
            cb(null, uploadDir);
        });
    },
    filename: (req, file, cb) => {
        const filename = `${Date.now()}-${file.originalname}`;
        log.info(`Processing file: ${file.originalname} -> ${filename}`);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 1024 // 1GB limit
    }
}).array('files');

// Middleware
app.use(cors());
app.use(express.static('public'));

// Routes
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            log.error(`Upload failed: ${err.message}`);
            return res.status(400).json({ 
                message: 'Upload failed', 
                error: err.message 
            });
        }

        if (!req.files || req.files.length === 0) {
            log.error('No files were uploaded');
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const fileDetails = req.files.map(f => ({
            originalName: f.originalname,
            savedAs: f.filename,
            size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`
        }));

        log.success(`Successfully uploaded ${req.files.length} files to ${uploadDir}:`);
        fileDetails.forEach(f => {
            log.success(`- ${f.originalName} (${f.size}) as ${f.savedAs}`);
        });

        res.json({ 
            message: 'Files uploaded successfully',
            files: fileDetails
        });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    log.error(`Unhandled error: ${err.message}`);
    res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Start server
app.listen(port, () => {
    log.info(`Server running at http://localhost:${port}`);
    log.info(`Upload directory: ${uploadDir}`);
    
    // Test directory permissions
    fs.access(uploadDir, fs.constants.W_OK, (err) => {
        if (err) {
            log.error(`WARNING: Upload directory not writable: ${err.message}`);
        } else {
            log.success('Upload directory is writable');
        }
    });
});
