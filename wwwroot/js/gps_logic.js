// Biến lưu trữ trạng thái để tránh lặp lội
let viTriNguoiDungMarker = null;
let quanDangPhat = null; // Tránh AI đọc lặp đi lặp lại 1 quán
let quanDangTuongTac = null; // Tránh Popup chớp tắt liên tục

// ==========================================
// 1. HỆ THỐNG PHÁT ÂM THANH (TEXT-TO-SPEECH)
// ==========================================
function docThongBao(vanBan, maNgonNgu = 'vi-VN') {
    const heThongGiongNoi = window.speechSynthesis || window.webkitSpeechSynthesis;

    if (heThongGiongNoi) {
        heThongGiongNoi.cancel();
        const cauDoc = new SpeechSynthesisUtterance(vanBan);

        // Gán mã ngôn ngữ để trình duyệt đổi giọng đọc chuẩn
        cauDoc.lang = maNgonNgu;
        cauDoc.rate = 0.9;
        cauDoc.pitch = 1.0;

        heThongGiongNoi.speak(cauDoc);
    } else {
        console.error("Lỗi: Không tìm thấy SpeechSynthesis API.");
    }
}

// ==========================================
// 2. RADAR QUÉT VỊ TRÍ LIÊN TỤC
// ==========================================
function khoiDongRadar(danhSachQuanAn, map) {
    if (!navigator.geolocation) {
        alert("Thiết bị của bạn không hỗ trợ định vị GPS!");
        return;
    }

    console.log("🚀 Đã bật Radar theo dõi...");

    navigator.geolocation.watchPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            // Gọi 1 hàm duy nhất xử lý cả Popup và Giọng nói
            xuLyKhiKhachDiChuyen(lat, lng, danhSachQuanAn, map);
        },
        function (error) {
            console.warn("Lỗi Radar GPS: ", error.message);
        },
        {
            enableHighAccuracy: false, // SỬA THÀNH FALSE ĐỂ KHÔNG BỊ LỖI TRÊN MÁY TÍNH
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ==========================================
// 3. THUẬT TOÁN XỬ LÝ KHI KHÁCH DI CHUYỂN
// ==========================================
function xuLyKhiKhachDiChuyen(userLat, userLng, danhSachQuanAn, map) {

    // --- ĐÃ BỔ SUNG: VẼ VỊ TRÍ CỦA BẠN LÊN BẢN ĐỒ ---
    if (!viTriNguoiDungMarker) {
        // Nếu chưa có ghim thì tạo một chấm tròn màu xanh dương
        viTriNguoiDungMarker = L.circleMarker([userLat, userLng], {
            radius: 8,
            fillColor: "#2980b9",
            color: "#ffffff",
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);
    } else {
        // Nếu đã có ghim rồi, chỉ cần dời nó tới tọa độ mới từ Sensor
        viTriNguoiDungMarker.setLatLng([userLat, userLng]);
    }

    if (!danhSachQuanAn || danhSachQuanAn.length === 0) return;

    let phatHienQuan = false;

    for (let i = 0; i < danhSachQuanAn.length; i++) {
        const quan = danhSachQuanAn[i];
        if (!quan.latitude || !quan.longitude) continue;

        // Tính khoảng cách (Dùng luôn thư viện của Bản đồ Leaflet cho nhanh)
        const khoangCach = map.distance([userLat, userLng], [quan.latitude, quan.longitude]);
        const banKinhQuet = quan.trigger_radius || 30;

        // NẾU KHÁCH BƯỚC VÀO VÙNG KÍCH HOẠT (TRONG BÁN KÍNH 30m)
        if (khoangCach <= banKinhQuet) {
            phatHienQuan = true;

            // --- A. BẬT POPUP (Chỉ gọi 1 lần để không bị giật lag) ---
            if (quanDangTuongTac !== quan.poi_id) {
                quanDangTuongTac = quan.poi_id;
                Promise.resolve(hienThiPopupMenu(quan)); // Hiện giao diện
                ghiNhanCheckIn(quan.poi_id); // Gửi data lên Supabase
            }

            // --- B. ĐỌC THÔNG BÁO AI (Đa ngôn ngữ dùng MyMemory) ---
            if (quanDangPhat !== quan.poi_id) {
                quanDangPhat = quan.poi_id;

                const langFull = document.getElementById('ngonNguSelect')
                    ? document.getElementById('ngonNguSelect').value : 'vi-VN';
                const langCode = langFull.split('-')[0];

                const loiChaoVI = `Bạn đã đến gần ${quan.name_vi}`;

                if (typeof dichVanBan === 'function' && langCode !== 'vi') {
                    dichVanBan(loiChaoVI, langCode).then(loiChaoDich => {
                        docThongBao(loiChaoDich, langFull);
                    });
                } else {
                    docThongBao(loiChaoVI, langFull);
                }

                console.log(`[Radar] Đang đọc: ${loiChaoVI} (Cách ${khoangCach.toFixed(1)}m)`);
            }

            break; // Đã tìm thấy quán gần nhất rồi thì dừng vòng lặp
        }
        // NẾU KHÁCH ĐÃ ĐI XA KHỎI QUÁN (> 40m) THÌ RESET TRẠNG THÁI AI
        else if (khoangCach > banKinhQuet + 10) {
            if (quanDangPhat === quan.poi_id) {
                quanDangPhat = null;
            }
        }
    }

    // NẾU RA KHỎI VÙNG CỦA TẤT CẢ CÁC QUÁN -> TỰ ĐỘNG TẮT POPUP
    if (!phatHienQuan) {
        quanDangTuongTac = null;
        dongPopup();
    }
}