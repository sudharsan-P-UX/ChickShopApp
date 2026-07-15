const db = require('../config/db');
const https = require('https');

// Pure Node.js manual buffer multipart compiler for Catbox.moe
const uploadToCatbox = (file) => {
  if (!file) return Promise.resolve(null);
  return new Promise((resolve) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const header1 = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`
    );
    const header2 = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    
    const bodyBuffer = Buffer.concat([header1, header2, file.buffer, footer]);
    
    const req = https.request('https://catbox.moe/user/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data.trim());
        } else {
          resolve(`UPLOAD_ERROR: Status ${res.statusCode} - ${data.trim()}`);
        }
      });
    });
    
    req.on('error', (err) => {
      resolve(`UPLOAD_ERROR: Connection failed - ${err.message}`);
    });
    
    req.write(bodyBuffer);
    req.end();
  });
};

// Helper to decode Base64 data and upload it
const uploadBase64ToCatbox = async (base64Data) => {
  if (!base64Data || !base64Data.startsWith('data:')) return base64Data;
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return 'UPLOAD_ERROR: Invalid base64 regex match';
    
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const extension = mimeType.split('/')[1] || 'png';
    const originalname = `upload.${extension}`;
    
    return await uploadToCatbox({
      buffer,
      originalname,
      mimetype: mimeType
    });
  } catch (err) {
    return `UPLOAD_ERROR: Base64 decode error - ${err.message}`;
  }
};

exports.getAllItems = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM inventory ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addItem = async (req, res) => {
  const { item_name, description, qty, price, image_url } = req.body;
  try {
    let uploadedUrl = null;
    if (image_url) {
      uploadedUrl = await uploadBase64ToCatbox(image_url);
    } else if (req.file) {
      uploadedUrl = await uploadToCatbox(req.file);
    }
    
    if (uploadedUrl && uploadedUrl.startsWith('UPLOAD_ERROR:')) {
      return res.status(500).json({ error: uploadedUrl });
    }
    
    const { rows } = await db.query(
      'INSERT INTO inventory (item_name, description, qty, price, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [item_name, description, qty, price, uploadedUrl]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { item_name, description, qty, price, image_url } = req.body;
  try {
    let uploadedUrl = req.body.image_url;
    if (image_url && image_url.startsWith('data:')) {
      uploadedUrl = await uploadBase64ToCatbox(image_url);
    } else if (req.file) {
      uploadedUrl = await uploadToCatbox(req.file);
    }
    
    if (uploadedUrl && uploadedUrl.startsWith('UPLOAD_ERROR:')) {
      return res.status(500).json({ error: uploadedUrl });
    }
    
    const { rows } = await db.query(
      'UPDATE inventory SET item_name = $1, description = $2, qty = $3, price = $4, image_url = $5 WHERE id = $6 RETURNING *',
      [item_name, description, qty, price, uploadedUrl, id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM inventory WHERE id = $1', [id]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
