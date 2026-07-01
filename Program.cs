using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.FileProviders;
using System;
using System.IO;

// 1. RADAR TỰ ĐỘNG DÒ TÌM THƯ MỤC GỐC CHỨA WWWROOT
string rootPath = AppContext.BaseDirectory;

// Cứ lùi dần lên thư mục cha cho đến khi tìm thấy wwwroot
while (!Directory.Exists(Path.Combine(rootPath, "wwwroot")) && Directory.GetParent(rootPath) != null)
{
    rootPath = Directory.GetParent(rootPath).FullName;
}

// Nếu lùi hết cỡ mà vẫn không thấy, đành lấy thư mục hiện hành để tránh sập app
if (!Directory.Exists(Path.Combine(rootPath, "wwwroot")))
{
    rootPath = Directory.GetCurrentDirectory();
}

// 2. KHỞI TẠO MÁY CHỦ VỚI TỌA ĐỘ CHUẨN XÁC 100%
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = rootPath
});

var app = builder.Build();

// 3. CẤU HÌNH GIAO DIỆN VÀ ÉP LUẬT TRANG CHỦ
string wwwrootPath = Path.Combine(rootPath, "wwwroot");

if (Directory.Exists(wwwrootPath))
{
    var physicalProvider = new PhysicalFileProvider(wwwrootPath);
    
    // Đổi luật: Ép portal.html làm trang chủ thay vì index.html
    var defaultOptions = new DefaultFilesOptions();
    defaultOptions.DefaultFileNames.Clear();
    defaultOptions.DefaultFileNames.Add("portal.html");
    defaultOptions.FileProvider = physicalProvider;
    
    app.UseDefaultFiles(defaultOptions);
    app.UseStaticFiles(new StaticFileOptions { FileProvider = physicalProvider, RequestPath = "" });
    
    Console.WriteLine($"\n[THÀNH CÔNG] Đã khóa tọa độ thư mục gốc tại: {rootPath}\n");
}
else
{
    Console.WriteLine("\n[LỖI CỰC NẶNG]: Đã quét toàn bộ hệ thống nhưng không tìm thấy thư mục wwwroot!\n");
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
// app.MapControllers(); // Bật dòng này lên sau nếu bạn viết API C#

app.Run("http://0.0.0.0:5019");