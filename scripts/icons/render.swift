// Renders the app icon's 1024px masters from the SVG; run by scripts/icons/build.js.
// swift render.swift <in.svg> <out.png> <plain|mac> [background hex]
// plain: the art full-bleed on transparent, 1024px.
// mac: Apple's icon grid: an 824px rounded square (radius 185) centred on a
// 1024px transparent canvas, filled with bg, the art clipped inside it.
import AppKit

let args = CommandLine.arguments
let svg = NSImage(contentsOf: URL(fileURLWithPath: args[1]))!
let out = URL(fileURLWithPath: args[2])
let mode = args[3]
let bgHex = args.count > 4 ? args[4] : "f8eed5"

func color(_ hex: String) -> NSColor {
  let v = Int(hex, radix: 16)!
  return NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255,
                 blue: CGFloat(v & 255) / 255, alpha: 1)
}

let size = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current!.imageInterpolation = .high

if mode == "mac" {
  let tile = NSRect(x: 100, y: 100, width: 824, height: 824)
  let path = NSBezierPath(roundedRect: tile, xRadius: 185, yRadius: 185)
  color(bgHex).setFill()
  path.fill()
  path.addClip()
  svg.draw(in: tile)
} else {
  svg.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
}

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: out)
