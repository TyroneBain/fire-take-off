import Foundation
import PDFKit
import AppKit

// Research oracle using Apple's renderer, independent of the future app renderer.
guard CommandLine.arguments.count == 3 || (CommandLine.arguments.count == 4 && CommandLine.arguments[3] == "--metadata-only") else {
    fputs("Usage: inspect-drawing-fixture input.pdf output-directory [--metadata-only]\n", stderr)
    exit(2)
}
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let metadataOnly = CommandLine.arguments.count == 4
guard let document = PDFDocument(url: input), document.pageCount > 0 else {
    fputs("Invalid or empty PDF\n", stderr)
    exit(1)
}
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
var pages: [[String: Any]] = []
for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else { exit(1) }
    let bounds = page.bounds(for: .mediaBox)
    if metadataOnly {
        let crop = page.bounds(for: .cropBox)
        pages.append(["index": index, "widthPoints": bounds.width, "heightPoints": bounds.height,
                      "rotation": page.rotation, "text": page.string ?? "",
                      "cropBox": [crop.minX, crop.minY, crop.width, crop.height]])
        continue
    }
    let turns = ((page.rotation % 360) + 360) % 360
    let sideways = turns == 90 || turns == 270
    let width = Int((sideways ? bounds.height : bounds.width) * 2)
    let height = Int((sideways ? bounds.width : bounds.height) * 2)
    guard width > 0, height > 0, width <= 10000, height <= 10000,
          let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width,
            pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4,
            hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
            bytesPerRow: 0, bitsPerPixel: 0),
          let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else { exit(1) }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics
    let context = graphics.cgContext
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: 2, y: 2)
    context.translateBy(x: -bounds.minX, y: -bounds.minY)
    page.draw(with: .mediaBox, to: context)
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else { exit(1) }
    let name = "page-\(index+1).png"
    try png.write(to: output.appendingPathComponent(name))
    let crop = page.bounds(for: .cropBox)
    pages.append(["index": index, "widthPoints": bounds.width, "heightPoints": bounds.height,
                  "cropBox": [crop.minX, crop.minY, crop.width, crop.height],
                  "rotation": page.rotation, "text": page.string ?? "", "render": name,
                  "pixelWidth": width, "pixelHeight": height])
}
let report: [String: Any] = ["renderer": "Apple PDFKit", "scale": 2, "metadataOnly": metadataOnly,
                            "pageCount": document.pageCount, "pages": pages]
let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
try data.write(to: output.appendingPathComponent("inspection.json"))
print(String(data: data, encoding: .utf8)!)
