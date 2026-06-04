async function run() {
  const payload = {
    tenantUsername: "dapur-athaya", 
    customerName: "Test", 
    customerPhone: "0812345678", 
    shippingAddress: "DIGITAL_ORDER", 
    shippingCost: 0, 
    paymentMethod: "ONLINE", 
    channel: "DIRECT", 
    items: [{productName: "Test", price: 10000, quantity: 1, blockId: "test", productId: "test"}]
  };
  
  const res = await fetch('https://api.tuppy.my.id/orders/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
