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
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed && parsed.data && parsed.data.url) {
            resolve(parsed.data.url);
          } else {
            resolve('UPLOAD_ERROR: ImgBB response structure incorrect');
          }
        } catch (e) {
          resolve('UPLOAD_ERROR: ' + e.message);
        }
      });
    });
    
    req.on('error', (err) => {
      resolve('UPLOAD_ERROR: ' + err.message);
    });
    
    req.write(postData);
    req.end();
  });
};

exports.getAllLabels = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM custom_labels ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateLabels = async (req, res) => {
  const { labels } = req.body; // Array of { label_key, custom_label }
  try {
    if (!Array.isArray(labels)) {
      return res.status(400).json({ message: 'labels must be an array' });
    }
    
    for (const item of labels) {
      let customLabelVal = item.custom_label;
      if (item.label_key === 'app_logo' && customLabelVal && customLabelVal.startsWith('data:')) {
        const uploadedUrl = await uploadToImgBB(customLabelVal);
        if (!uploadedUrl.startsWith('UPLOAD_ERROR:')) {
          customLabelVal = uploadedUrl;
        } else {
          console.error(uploadedUrl);
        }
      }
      await db.query(
        'UPDATE custom_labels SET custom_label = $1 WHERE label_key = $2',
        [customLabelVal, item.label_key]
      );
    }
    
    const { rows } = await db.query('SELECT * FROM custom_labels ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
