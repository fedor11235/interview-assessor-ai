import Foundation
import ImageIO
import Vision

struct OcrOutput: Encodable {
  let text: String
  let lines: [String]
}

func printJson(_ output: OcrOutput) {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.withoutEscapingSlashes]

  if let data = try? encoder.encode(output), let json = String(data: data, encoding: .utf8) {
    print(json)
  } else {
    print("{\"text\":\"\",\"lines\":[]}")
  }
}

guard CommandLine.arguments.count >= 2 else {
  printJson(OcrOutput(text: "", lines: []))
  exit(0)
}

let imageUrl = URL(fileURLWithPath: CommandLine.arguments[1])

guard
  let imageSource = CGImageSourceCreateWithURL(imageUrl as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
else {
  printJson(OcrOutput(text: "", lines: []))
  exit(0)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.minimumTextHeight = 0.012

if #available(macOS 11.0, *) {
  request.recognitionLanguages = ["ru-RU", "en-US"]
}

let handler = VNImageRequestHandler(cgImage: image, options: [:])

do {
  try handler.perform([request])
  let lines = (request.results ?? [])
    .compactMap { observation in
      observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    .filter { !$0.isEmpty }

  printJson(OcrOutput(text: lines.joined(separator: "\n"), lines: lines))
} catch {
  printJson(OcrOutput(text: "", lines: []))
}
