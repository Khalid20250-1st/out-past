import Foundation
#if arch(arm64) && canImport(FoundationModels)
import FoundationModels
#endif

// KAI's Apple Intelligence engine. Reads {"system","prompt"} as JSON on stdin,
// writes {"answer","engine"} or {"error"} as JSON on stdout. On-device, free,
// nothing leaves the Mac. If Apple Intelligence is not present it exits non-zero
// and the app falls back to Ollama, then to the Kidus Brain.

struct In: Decodable { let system: String?; let prompt: String }

func emit(_ d: [String: Any]) {
  if let j = try? JSONSerialization.data(withJSONObject: d) {
    FileHandle.standardOutput.write(j)
  }
}

let data = FileHandle.standardInput.readDataToEndOfFile()
guard let input = try? JSONDecoder().decode(In.self, from: data) else {
  emit(["error": "bad-input"]); exit(1)
}

#if arch(arm64) && canImport(FoundationModels)
if #available(macOS 26, *) {
  if case .available = SystemLanguageModel.default.availability {
    let sem = DispatchSemaphore(value: 0)
    Task {
      do {
        let session = LanguageModelSession(instructions: input.system ?? "")
        let r = try await session.respond(to: input.prompt)
        emit(["answer": r.content, "engine": "apple"])
      } catch {
        emit(["error": "apple-error: \(error)"])
      }
      sem.signal()
    }
    sem.wait()
    exit(0)
  }
}
#endif

emit(["error": "apple-unavailable"])
exit(2)
