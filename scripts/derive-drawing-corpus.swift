import Foundation
import PDFKit
import AppKit

guard CommandLine.arguments.count == 4 else {
    fputs("Usage: derive-drawing-corpus input.pdf rendered-page.png output-directory\n", stderr)
    exit(2)
}
guard let source = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])),
      let first = source.page(at: 0),
      let image = NSImage(contentsOfFile: CommandLine.arguments[2]) else { exit(1) }
let output = URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
func save(_ document: PDFDocument, _ name: String) {
    guard document.write(to: output.appendingPathComponent(name)) else { exit(1) }
}
for count in [10, 100] {
    let document = PDFDocument()
    for index in 0..<count {
        guard let page = first.copy() as? PDFPage else { exit(1) }
        document.insert(page, at: index)
    }
    save(document, "vector-\(count)-pages.pdf")
}
let rotated = PDFDocument()
guard let page = first.copy() as? PDFPage else { exit(1) }
page.rotation = 90
page.setBounds(CGRect(x: 40, y: 40, width: 400, height: 700), for: .cropBox)
rotated.insert(page, at: 0)
save(rotated, "rotated-cropped.pdf")
image.size = NSSize(width: 595, height: 842)
guard let rasterPage = PDFPage(image: image) else { exit(1) }
rasterPage.setBounds(CGRect(x: 0, y: 0, width: 595, height: 842), for: .mediaBox)
let raster = PDFDocument()
raster.insert(rasterPage, at: 0)
save(raster, "small-raster.pdf")
print("Derived original corpus: vector 10/100 pages, rotated/cropped, raster")
