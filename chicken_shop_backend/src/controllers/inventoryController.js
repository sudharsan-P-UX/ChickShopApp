const db = require('../config/db');
const https = require('https');

// Secure programatic image upload helper using ImgBB
// Falls back to Picsum Photos if no API key is configured
const uploadToImgBB = (base64Data) => {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.warn('IMGBB_API_KEY is not defined, returning fallback placeholder');
    return Promise.resolve('https://picsum.photos/200');
  }
  
  return new Promise((resolve) => {
    // Strip base64 data prefix (e.g. "data:image/png;base64,")
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const postData = new URLSearchParams({
      image: cleanBase64
    }).toString();
    
    const req = https.request(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success) {
            resolve(json.data.url);
          } else {
            resolve(`UPLOAD_ERROR: ImgBB status ${res.statusCode} - ${json.error.message}`);
          }
        } catch (e) {
          resolve(`UPLOAD_ERROR: JSON parse error - ${data.trim()}`);
        }
      });
    });
    
    req.on('error', (err) => {
      resolve(`UPLOAD_ERROR: Connection failed - ${err.message}`);
    });
    
    req.write(postData);
    req.end();
  });
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
      uploadedUrl = await uploadToImgBB(image_url);
    } else if (req.file) {
      const base64Str = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      uploadedUrl = await uploadToImgBB(base64Str);
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
    // Fetch existing item to preserve image if no new one is provided
    const existing = await db.query('SELECT image_url FROM inventory WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    const currentImageUrl = existing.rows[0].image_url;

    let uploadedUrl = req.body.image_url;
    if (image_url && image_url.startsWith('data:')) {
      uploadedUrl = await uploadToImgBB(image_url);
    } else if (req.file) {
      const base64Str = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      uploadedUrl = await uploadToImgBB(base64Str);
    } else if (!image_url) {
      uploadedUrl = currentImageUrl;
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
