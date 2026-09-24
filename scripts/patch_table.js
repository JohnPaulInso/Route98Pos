const fs = require('fs');
let c = fs.readFileSync('js/inventory.js', 'utf8');

// Fix table tag - add min-width and table-layout
c = c.replace(
  '<table class="data" style="width:100%;font-size:0.82rem;">',
  '<table class="data" style="width:100%;min-width:580px;font-size:0.82rem;table-layout:fixed;">'
);

// Fix th headers - add column widths
c = c.replace(
  '<th>Date & Time</th>',
  '<th style="width:140px;">Date & Time</th>'
);
c = c.replace(
  '<th>Receipt #</th>',
  '<th style="width:100px;">Receipt #</th>'
);
c = c.replace(
  '<th>Cashier</th>',
  '<th style="width:90px;">Cashier</th>'
);
c = c.replace(
  '<th>Quantity</th>',
  '<th style="width:70px;">Quantity</th>'
);
c = c.replace(
  '<th>Unit Price</th>',
  '<th style="width:80px;">Unit Price</th>'
);

fs.writeFileSync('js/inventory.js', c);
console.log('done');
