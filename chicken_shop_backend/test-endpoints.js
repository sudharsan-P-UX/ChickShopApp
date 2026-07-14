// test-endpoints.js
const http = require('http');

const PORT = 5000;
const HOST = 'localhost';

function request(path, method, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Accept': 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, message: parsed.message || parsed.error || data });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, message: data });
          } else {
            resolve(data);
          }
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Chicken Shop POS API Integration Tests ---');
  let token = null;
  let testItemId = null;

  try {
    // 1. Register test user (in case it doesn't exist)
    console.log('\n[0/7] Pre-registering test user (POST /api/auth/register)...');
    try {
      await request('/api/auth/register', 'POST', {
        username: 'admin_test',
        password: 'admin123',
        role: 'admin'
      });
      console.log('✅ Registration successful!');
    } catch (err) {
      if (err.message && (err.message.includes('unique') || err.message.includes('already exists') || err.status === 500)) {
        console.log('ℹ️ User admin_test already registered. Proceeding.');
      } else {
        throw err;
      }
    }

    // 1b. Test Login
    console.log('\n[1/7] Testing Login endpoint (POST /api/auth/login)...');
    const loginRes = await request('/api/auth/login', 'POST', {
      username: 'admin_test',
      password: 'admin123'
    });
    token = loginRes.token;
    console.log('✅ Login successful! Token retrieved.');

    // 2. Test Add Inventory Item
    console.log('\n[2/7] Testing Add Inventory Item endpoint (POST /api/inventory)...');
    const itemRes = await request('/api/inventory', 'POST', {
      item_name: 'Test Fried Chicken',
      description: 'Yummy crispy test wings',
      qty: 100,
      price: 199.00
    }, token);
    testItemId = itemRes.id;
    console.log(`✅ Add Inventory Item successful! Created Item ID: ${testItemId}`);

    // 3. Test Get Inventory
    console.log('\n[3/7] Testing Get Inventory endpoint (GET /api/inventory)...');
    const invList = await request('/api/inventory', 'GET', null, token);
    const createdItem = invList.find(i => i.id === testItemId);
    if (!createdItem) throw new Error('Created item not found in inventory list');
    console.log(`✅ Get Inventory successful! Item found with quantity: ${createdItem.qty}`);

    // 4. Test Add Customer
    console.log('\n[4/7] Testing Register Customer endpoint (POST /api/customers)...');
    const customerPhone = '9876543210';
    try {
      const customerRes = await request('/api/customers', 'POST', {
        phone_no: customerPhone,
        name: 'Sudharsan R'
      }, token);
      console.log(`✅ Customer registered! Phone: ${customerRes.phone_no}, Name: ${customerRes.name}`);
    } catch (err) {
      if (err.message && err.message.includes('unique')) {
        console.log('ℹ️ Customer already registered. Proceeding.');
      } else {
        throw err;
      }
    }

    // 5. Test Get Customer by Phone
    console.log('\n[5/7] Testing Get Customer by Phone endpoint (GET /api/customers/:phone)...');
    const customer = await request(`/api/customers/${customerPhone}`, 'GET', null, token);
    if (customer.phone_no !== customerPhone) throw new Error('Returned customer phone number does not match');
    console.log(`✅ Customer retrieved successfully! Name: ${customer.name}`);

    // 6. Test Save Pending Bill
    console.log('\n[6/7] Testing Save Pending Bill endpoint (POST /api/billing/pending)...');
    const pendingBill = await request('/api/billing/pending', 'POST', {
      items: [{
        id: testItemId,
        item_name: 'Test Fried Chicken',
        qty: 2,
        price: 199.00
      }],
      subtotal: 398.00
    }, token);
    const pendingId = pendingBill.id;
    console.log(`✅ Pending bill saved successfully! ID: ${pendingId}`);

    // 6b. Test Get Pending Bills
    console.log('\n[6b/7] Testing Get Pending Bills endpoint (GET /api/billing/pending)...');
    const pendingList = await request('/api/billing/pending', 'GET', null, token);
    const savedPending = pendingList.find(b => b.id === pendingId);
    if (!savedPending) throw new Error('Saved pending bill not found in list');
    console.log(`✅ Pending bill found in list! Items count: ${savedPending.items.length}`);

    // 6c. Test Complete Bill and auto-delete pending
    console.log('\n[6c/7] Testing Complete Bill (restored from pending) (POST /api/billing/complete)...');
    const billRes = await request('/api/billing/complete', 'POST', {
      customer_phone: customerPhone,
      items: [{
        id: testItemId,
        item_name: 'Test Fried Chicken',
        qty: 2,
        price: 199.00
      }],
      total_amount: 398.00,
      discount: 38.00,
      final_price: 360.00,
      pending_bill_id: pendingId
    }, token);
    console.log(`✅ Bill completed successfully! Bill No: #${billRes.bill_no}`);

    // 6d. Verify Pending Bill was deleted
    console.log('\n[6d/7] Verifying pending bill auto-deletion...');
    const pendingListAfter = await request('/api/billing/pending', 'GET', null, token);
    const deletedPending = pendingListAfter.find(b => b.id === pendingId);
    if (deletedPending) throw new Error('Pending bill was not deleted after completion');
    console.log('✅ Pending bill auto-deletion verified!');

    // 7. Verify Inventory Quantity Decreased
    console.log('\n[7/7] Verifying Inventory reduction...');
    const invListAfter = await request('/api/inventory', 'GET', null, token);
    const updatedItem = invListAfter.find(i => i.id === testItemId);
    console.log(`Original Quantity: 100`);
    console.log(`Purchased Quantity: 2`);
    console.log(`Current Quantity: ${updatedItem.qty}`);
    if (parseInt(updatedItem.qty) !== 98) {
      throw new Error(`Quantity mismatch! Expected 98, got ${updatedItem.qty}`);
    }
    console.log('✅ Inventory quantity reduction verified!');

    // Cleanup: Delete the test item
    console.log('\n[Cleanup] Deleting test item...');
    await request(`/api/inventory/${testItemId}`, 'DELETE', null, token);
    console.log('✅ Test item deleted from inventory.');

    console.log('\n🎉 ALL ENDPOINT INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
