// OCR a PDF with macOS Vision (no tesseract needed).
//
//   swift scripts/price-lists/ocr-pdf.swift file.pdf > file.ocr.jsonl
//
// Emits one JSON object per recognized line: {"page":1,"x":0.12,"y":0.87,"w":0.3,"h":0.01,"text":"..."}
// x/y/w/h are normalized (0-1) with the origin at the TOP-left, so callers can rebuild table rows
// by grouping on y and sorting on x.
import Foundation
import Vision
import PDFKit
import AppKit

guard CommandLine.arguments.count > 1, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    FileHandle.standardError.write("usage: swift ocr-pdf.swift <file.pdf>\n".data(using: .utf8)!)
    exit(2)
}

let scale: CGFloat = 3.0 // ~216 dpi — enough for 8pt part numbers
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    let image = NSImage(size: size)
    image.lockFocus()
    NSColor.white.setFill()
    NSRect(origin: .zero, size: size).fill()
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    image.unlockFocus()
    guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false // keep part numbers like C-00073 verbatim
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
    for obs in request.results ?? [] {
        guard let top = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox // Vision origin is bottom-left
        let rec: [String: Any] = ["page": i + 1, "x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height, "text": top.string]
        let data = try! JSONSerialization.data(withJSONObject: rec)
        print(String(data: data, encoding: .utf8)!)
    }
}
