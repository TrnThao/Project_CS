delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const toaDoQuan4 = [10.7615, 106.7004];
const map = L.map('map-container').setView(toaDoQuan4, 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

const markerGroup = L.layerGroup().addTo(map);
let tatCaQuanAn = [];
let duongDiHienTai = null;
let quanDangChiDan = null;

// ===================================================================
// DỊCH THUẬT - GOOGLE TRANSLATE
// ===================================================================
const cacheDich = {};

async function dichVanBan(vanBan, ngonNguDich) {
    if (!vanBan || ngonNguDich === 'vi') return vanBan;
    const cacheKey = `${ngonNguDich}_${vanBan}`;
    if (cacheDich[cacheKey]) return cacheDich[cacheKey];
    try {
        const langMap = { 'en': 'en', 'ko': 'ko', 'zh': 'zh-CN', 'ja': 'ja' };
        const targetLang = langMap[ngonNguDich] || ngonNguDich;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(vanBan)}`;
        const res = await fetch(url);
        const data = await res.json();
        const ketQua = data[0].map(item => item[0]).join('');
        cacheDich[cacheKey] = ketQua;
        return ketQua;
    } catch (err) {
        console.error("Lỗi dịch:", err);
        return vanBan;
    }
}

// Các text đa ngôn ngữ
const ngheText = {
    'vi': '🔊 Nghe Giới Thiệu',
    'en': '🔊 Listen',
    'ko': '🔊 듣기',
    'zh': '🔊 听',
    'ja': '🔊 聞く'
};

const phutText = {
    'vi': 'phút', 'en': 'min', 'ko': '분', 'zh': '分钟', 'ja': '分'
};

const viTriText = {
    'vi': 'Vui lòng bấm vào bản đồ để chọn vị trí của bạn trước!',
    'en': 'Please tap on the map to set your location first!',
    'ko': '먼저 지도를 탭하여 위치를 설정하세요!',
    'zh': '请先点击地图选择您的位置！',
    'ja': 'まず地図をタップして位置を設定してください！'
};

// Lấy langCode hiện tại
function getLangCode() {
    return document.getElementById('ngonNguSelect').value.split('-')[0];
}

// ===================================================================
// 1. TẢI DỮ LIỆU TỪ SUPABASE
// ===================================================================
async function taiDuLieuVaCamCo() {
    const { data, error } = await supabaseClient
        .from('pois')
        .select('*')
        .eq('status', 'active');
    if (error) { console.error("Lỗi Supabase:", error); return; }
    tatCaQuanAn = data;

    const savedLang = localStorage.getItem('selectedLang') || 'vi-VN';
    document.getElementById('ngonNguSelect').value = savedLang;

    veBanDo(tatCaQuanAn);
    if (typeof khoiDongRadar === "function") khoiDongRadar(tatCaQuanAn, map);
}

// ===================================================================
// 2. VẼ ĐƯỜNG ĐI OSRM
// ===================================================================
async function veduongDi(userLat, userLng, quan) {
    if (duongDiHienTai) {
        map.removeLayer(duongDiHienTai);
        duongDiHienTai = null;
    }
    try {
        const url = `https://router.project-osrm.org/route/v1/foot/${userLng},${userLat};${quan.longitude},${quan.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
            const khoangCachThuc = route.distance.toFixed(0);
            const thoiGian = Math.ceil(route.duration / 60);

            duongDiHienTai = L.polyline(coords, {
                color: '#ff4757', weight: 5, opacity: 0.8
            }).addTo(map);

            // Lấy ngôn ngữ hiện tại
            const lc = document.getElementById('ngonNguSelect').value.split('-')[0];

            // Dịch tên quán theo ngôn ngữ
            const tenQuanDich = lc !== 'vi'
                ? await dichVanBan(quan.name_vi, lc)
                : quan.name_vi;

            document.getElementById('chiDanInfo').innerHTML = `
                <strong style="color:#ff4757">${tenQuanDich}</strong><br>
                📏 ${khoangCachThuc}m &nbsp; 🚶 ~${thoiGian} ${phutText[lc] || 'phút'}
                <button onclick="huyChiDan()" style="float:right; background:#ff4757; color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer;">✕</button>
            `;
            document.getElementById('chiDanInfo').style.display = 'block';
        }
    } catch (err) {
        console.error("Lỗi OSRM:", err);
    }
}

window.huyChiDan = function () {
    quanDangChiDan = null;
    if (duongDiHienTai) { map.removeLayer(duongDiHienTai); duongDiHienTai = null; }
    document.getElementById('chiDanInfo').style.display = 'none';
}

// ===================================================================
// 3. VẼ GHIM
// ===================================================================
function veBanDo(danhSach) {
    markerGroup.clearLayers();

    const langFull = document.getElementById('ngonNguSelect').value;
    const langCode = langFull.split('-')[0];

    const xemDanhGiaText = {
        'vi': '⭐ Xem Đánh Giá',
        'en': '⭐ View Reviews',
        'ko': '⭐ 리뷰 보기',
        'zh': '⭐ 查看评价',
        'ja': '⭐ レビューを見る'
    };

    danhSach.forEach(quan => {
        const marker = L.marker([quan.latitude, quan.longitude]);

        // Giao diện Popup sạch sẽ, có 3 nút bấm rõ ràng
        marker.bindPopup(`
            <div style="text-align:center; min-width:160px; padding:5px;">
                <h4 style="margin:0 0 8px 0; color:#ff4757; font-size:15px;" id="popup-ten-${quan.poi_id}">
                    ${quan.name_vi}
                </h4>
                <p style="font-size:12px; margin-bottom:12px; color:#777;" id="popup-mota-${quan.poi_id}">
                    ${quan.description_vi || 'Chưa có mô tả.'}
                </p>
                <button id="popup-danhgia-${quan.poi_id}" onclick="moModalXemDanhGia('${quan.poi_id}', '${quan.name_vi}')"
                    style="background:#f1c40f;color:#2c3e50;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;margin-bottom:6px;font-size:13px;">
                    ${xemDanhGiaText[langCode] || '⭐ Xem Đánh Giá'}
                </button>

                <button onclick="ngheGioiThieuQuan('${quan.name_vi}')"
                    style="background:#3498db;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;font-size:13px;"
                    id="popup-nghe-${quan.poi_id}">
                    ${ngheText[langCode] || '🔊 Nghe Giới Thiệu'}
                </button>
            </div>
        `);

        // Xử lý dịch thuật tiêu đề và mô tả khi mở popup (bỏ phần tải sao bất đồng bộ ở đây)
        marker.on('popupopen', async function () {
            setTimeout(async () => {
            const lc = document.getElementById('ngonNguSelect').value.split('-')[0];
            if (lc === 'vi') return;

            const tenEl = document.getElementById(`popup-ten-${quan.poi_id}`);
            const motaEl = document.getElementById(`popup-mota-${quan.poi_id}`);
            const ngheEl = document.getElementById(`popup-nghe-${quan.poi_id}`);

            if (tenEl && tenEl.dataset.translated !== lc) {
                tenEl.innerText = '...';
                tenEl.innerText = quan[`name_${lc}`] || await dichVanBan(quan.name_vi, lc);
                tenEl.dataset.translated = lc;
            }
            if (motaEl && motaEl.dataset.translated !== lc) {
                motaEl.innerText = '...';
                motaEl.innerText = quan[`description_${lc}`] || await dichVanBan(quan.description_vi, lc);
                motaEl.dataset.translated = lc;
                }
                if (danhGiaEl) {
                    danhGiaEl.innerText = xemDanhGiaText[lc] || '⭐ Xem Đánh Giá';
                }
                if (ngheEl) ngheEl.innerText = ngheText[lc] || '🔊 Nghe Giới Thiệu';
            }, 50);
        });

        // Xử lý click để kích hoạt đường đi
        marker.on('click', function (ev) {
            ev.originalEvent.stopPropagation();
            if (!viTriNguoiDungMarker) return;
            quanDangChiDan = quan;
            const userLatLng = viTriNguoiDungMarker.getLatLng();
            veduongDi(userLatLng.lat, userLatLng.lng, quan);
            marker.openPopup();
        });

        const circle = L.circle([quan.latitude, quan.longitude], {
            color: 'red', fillColor: '#f03', fillOpacity: 0.1, radius: quan.trigger_radius || 30
        });
        markerGroup.addLayer(marker);
        markerGroup.addLayer(circle);
    });
}

// ===================================================================
// 4. PHÁT ÂM GIỚI THIỆU
// ===================================================================
window.ngheGioiThieuQuan = async function (tenQuan) {
    const quan = tatCaQuanAn.find(q => q.name_vi === tenQuan);
    if (!quan) return;

    const ngonNguDaChon = document.getElementById('ngonNguSelect').value;
    const langCode = ngonNguDaChon.split('-')[0];

    let noiDungDoc = langCode !== 'vi'
        ? await dichVanBan(quan.description_vi, langCode)
        : (quan.description_vi || "Chưa có lời giới thiệu.");

    if (typeof docThongBao === "function") {
        docThongBao(noiDungDoc, ngonNguDaChon);
    } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(noiDungDoc);
        speech.lang = ngonNguDaChon;
        speech.rate = 0.9;
        window.speechSynthesis.speak(speech);
    }
}

// ===================================================================
// 5. BỘ LỌC TÌM KIẾM
// ===================================================================
function thucHienLoc() {
    const tuKhoa = document.getElementById('searchInput').value.toLowerCase();
    const danhMuc = document.getElementById('categorySelect').value;

    const ketQuaLoc = tatCaQuanAn.filter(quan => {
        const tenQuan = (quan.name_vi || "").toLowerCase();
        const danhMucDB = (quan.category || "").trim().toLowerCase();
        const danhMucLoc = danhMuc.trim().toLowerCase();
        return tenQuan.includes(tuKhoa) && ((danhMucLoc === 'all') || (danhMucDB === danhMucLoc));
    });

    veBanDo(ketQuaLoc);
}

taiDuLieuVaCamCo();

document.getElementById('ngonNguSelect').addEventListener('change', async function () {
    document.querySelectorAll('[data-translated]').forEach(el => {
        el.removeAttribute('data-translated');
    });
    await veBanDo(tatCaQuanAn);
});

// ===================================================================
// 6. ĐỊNH VỊ VỊ TRÍ CỦA TÔI
// ===================================================================
function timViTriCuaToi() {
    if (typeof viTriNguoiDungMarker !== "undefined" && viTriNguoiDungMarker !== null) {
        map.flyTo(viTriNguoiDungMarker.getLatLng(), 18, { animate: true, duration: 1.5 });
    } else {
        map.locate({ setView: false });
        map.once('locationfound', function (e) {
            map.flyTo(e.latlng, 18, { animate: true, duration: 1.5 });
            if (!viTriNguoiDungMarker) {
                viTriNguoiDungMarker = L.circleMarker(e.latlng, {
                    color: 'white', fillColor: '#007bff', fillOpacity: 1, radius: 8, weight: 2
                }).addTo(map);
            } else {
                viTriNguoiDungMarker.setLatLng(e.latlng);
            }
            viTriNguoiDungMarker.bindPopup("Bạn đang ở đây!").openPopup();
        });
        map.once('locationerror', function () {
            alert("Không tìm thấy GPS! Vui lòng cấp quyền vị trí.");
        });
    }
}

// ===================================================================
// 7. CLICK BẢN ĐỒ - GIẢ LẬP VỊ TRÍ & CẬP NHẬT ĐƯỜNG ĐI
// ===================================================================
map.on('click', async function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (viTriNguoiDungMarker) {
        viTriNguoiDungMarker.setLatLng([lat, lng]);
    } else {
        viTriNguoiDungMarker = L.circleMarker([lat, lng], {
            color: 'white', fillColor: '#007bff',
            fillOpacity: 1, radius: 8, weight: 2
        }).addTo(map);
    }

    if (quanDangChiDan) {
        await veduongDi(lat, lng, quanDangChiDan);
    }

    if (typeof xuLyKhiKhachDiChuyen === 'function') {
        xuLyKhiKhachDiChuyen(lat, lng, tatCaQuanAn, map);
    }
});