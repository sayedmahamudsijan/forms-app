const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Note: Requires multer middleware in server.js for file handling
const uploadImage = async (file, userId = null) => {
  try {
    if (!file || !file.path) {
      console.error('❌ Image upload: No file provided or invalid file object', {
        userId,
        timestamp: new Date().toISOString(),
      });
      return { success: false, message: 'No file provided or invalid file object' };
    }

    console.log(`✅ Image upload: Starting upload for file ${file.path}`, {
      userId,
      filename: file.originalname,
      timestamp: new Date().toISOString(),
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'forms-app/templates',
      quality: 'auto',
      fetch_format: 'auto',
    });

    // Clean up temporary file
    await fs.unlink(file.path).catch(err => console.warn(`⚠️ Failed to delete temp file ${file.path}:`, {
      message: err.message,
      timestamp: new Date().toISOString(),
    }));

    console.log(`✅ Image upload: Successfully uploaded to ${result.secure_url}`, {
      userId,
      timestamp: new Date().toISOString(),
    });
    return { success: true, url: result.secure_url };
  } catch (error) {
    console.error('❌ Image upload error:', {
      userId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return { success: false, message: `Image upload failed: ${error.message}` };
  }
};

module.exports = { uploadImage };