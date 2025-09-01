// ====== DOM refs ======
const form = document.getElementById("messageForm");
const btnSubmit = document.getElementById("submitBtn");
const res = document.getElementById("result");

const scanInput = document.getElementById("scanNumber");
const ocrStatus = document.getElementById("ocrStatus");
const imgFile = document.getElementById("imgFile");
const btnOcrImage = document.getElementById("btnOcrImage");

const btnOpenCam = document.getElementById("btnOpenCam");
const btnCapture = document.getElementById("btnCapture");
const btnCloseCam = document.getElementById("btnCloseCam");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

let stream = null;
let worker = null;

// ====== Helper: อัปเดตสถานะ OCR ======
function setOcrStatus(text) {
  ocrStatus.textContent = `OCR: ${text}`;
}

// ====== สร้าง tesseract worker (ครั้งเดียว) ======
async function ensureWorker() {
  if (worker) return worker;
  setOcrStatus("loading worker...");
  worker = await Tesseract.createWorker("eng", 1, {
    // แสดง progress ใน console
    logger: m => {
      if (m.status === "recognizing text") {
        setOcrStatus(`recognizing ${(m.progress * 100).toFixed(0)}%`);
      }
    }
  });

  // จำกัดให้ดึง “ตัวเลขเท่านั้น” เพื่อความแม่น/เร็ว
  await worker.setParameters({
    tessedit_char_whitelist: "0123456789",
    classify_bln_numeric_mode: "1"
  });
  setOcrStatus("ready");
  return worker;
}

// ====== OCR จาก Image File ======
btnOcrImage.addEventListener("click", async () => {
  if (!imgFile.files || !imgFile.files[0]) {
    alert("เลือกไฟล์ภาพก่อนนะ");
    return;
  }
  try {
    res.textContent = ""; res.className = "";
    setOcrStatus("starting...");
    const w = await ensureWorker();

    const file = imgFile.files[0];
    const imageBitmap = await createImageBitmap(file);

    // วาดลง canvas เพื่อส่งให้ tesseract (ช่วยควบคุมขนาด/คอนทราสต์ได้ภายหลัง)
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = imageBitmap.width;
    c.height = imageBitmap.height;
    ctx.drawImage(imageBitmap, 0, 0);

    const { data: { text } } = await w.recognize(c);
    const digits = (text || "").replace(/\D+/g, ""); // คัดเฉพาะตัวเลข
    if (!digits) throw new Error("ไม่พบตัวเลขในภาพ");

    scanInput.value = digits;
    flash(scanInput);
    setOcrStatus("done");
  } catch (err) {
    console.error(err);
    setOcrStatus("error");
    res.textContent = "OCR ไม่สำเร็จ: " + err.message;
    res.className = "err";
  }
});

// ====== กล้อง: เปิด/ปิด และจับภาพ ======
btnOpenCam.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }});
    video.srcObject = stream;
    video.style.display = "block";
    await video.play();
    btnCapture.disabled = false;
    btnCloseCam.disabled = false;
  } catch (err) {
    alert("เปิดกล้องไม่ได้: " + err.message);
  }
});

btnCloseCam.addEventListener("click", stopCamera);

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.pause();
  video.srcObject = null;
  video.style.display = "none";
  btnCapture.disabled = true;
  btnCloseCam.disabled = true;
}

btnCapture.addEventListener("click", async () => {
  if (!stream) return;
  try {
    res.textContent = ""; res.className = "";
    setOcrStatus("starting...");
    const w = await ensureWorker();

    // จับภาพจาก video ลง canvas
    const wVid = video.videoWidth, hVid = video.videoHeight;
    canvas.width = wVid; canvas.height = hVid;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, wVid, hVid);

    const { data: { text } } = await w.recognize(canvas);
    const digits = (text || "").replace(/\D+/g, "");
    if (!digits) throw new Error("ไม่พบตัวเลขจากกล้อง");

    scanInput.value = digits;
    flash(scanInput);
    setOcrStatus("done");
  } catch (err) {
    console.error(err);
    setOcrStatus("error");
    res.textContent = "OCR ไม่สำเร็จ: " + err.message;
    res.className = "err";
  }
});

// ====== ส่งฟอร์มไป Node/Apps Script ======
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  res.textContent = ""; res.className = "";

  const payload = {
    name:    document.getElementById("name").value.trim(),
    email:   document.getElementById("email").value.trim(),
    message: document.getElementById("message").value.trim(),
    status:  document.getElementById("status").value,
    scanNumber: scanInput.value.trim()
  };

  if (!payload.name || !payload.email || !payload.message || !payload.scanNumber) {
    res.textContent = "กรอก Name, Email, Message และ เลขที่สแกน ให้ครบก่อนนะ";
    res.className = "err";
    return;
  }

  btnSubmit.disabled = true; btnSubmit.textContent = "Sending…";

  try {
    const r = await fetch("http://localhost:3000/addMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const data = ct.includes("application/json") ? await r.json() : { ok:false, raw: await r.text() };

    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || data?.raw || "Request failed");
    }

    res.textContent = "ส่งสำเร็จ!";
    res.className = "ok";
    form.reset();
  } catch (err) {
    console.error(err);
    res.textContent = "ส่งไม่สำเร็จ: " + err.message;
    res.className = "err";
  } finally {
    btnSubmit.disabled = false; btnSubmit.textContent = "Send";
    stopCamera();
  }
});

// ====== ยูทิลิตี้ ======
function flash(el){
  const orig = el.style.backgroundColor;
  el.style.backgroundColor = "#fff7cc";
  setTimeout(()=> el.style.backgroundColor = orig, 300);
}
