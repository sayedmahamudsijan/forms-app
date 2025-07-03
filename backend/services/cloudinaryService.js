const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Uploads any supported file type (images, PDFs, videos, documents)
const uploadFile = async (file, userId = null) => {
  try {
    if (!file || !file.path) {
      console.error('❌ File upload: No file provided or invalid file object', {
        userId,
        timestamp: new Date().toISOString(),
      });
      return { success: false, message: 'No file provided or invalid file object' };
    }

    console.log(`✅ File upload: Starting upload for file ${file.path}`, {
      userId,
      filename: file.originalname,
      mimetype: file.mimetype,
      timestamp: new Date().toISOString(),
    });

    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'forms-app/templates',
      resource_type: 'auto', // Automatically detect file type (image, video, raw)
      quality: file.mimetype.startsWith('image/') ? 'auto' : undefined,
      fetch_format: file.mimetype.startsWith('image/') ? 'auto' : undefined,
    });

    // Clean up temporary file
    await fs.unlink(file.path).catch(err => console.warn(`⚠️ Failed to delete temp file ${file.path}:`, {
      message: err.message,
      timestamp: new Date().toISOString(),
    }));

    console.log(`✅ File upload: Successfully uploaded to ${result.secure_url}`, {
      userId,
      timestamp: new Date().toISOString(),
    });
    return { success: true, url: result.secure_url };
  } catch (error) {
    console.error('❌ File upload error:', {
      userId,
      message: error.message,
      stack: error.stack,
      filename: file?.originalname,
      mimetype: file?.mimetype,
      timestamp: new Date().toISOString(),
    });
    return { success: false, message: `File upload failed: ${error.message}` };
  }
};

module.exports = { uploadFile };
