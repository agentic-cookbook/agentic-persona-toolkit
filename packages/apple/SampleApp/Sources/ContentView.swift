import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.2.wave.2.fill")
                .font(.system(size: 48))
                .foregroundStyle(.tint)
            Text("Hello, World!")
                .font(.largeTitle)
            Text("Agentic Developer Toolkit")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .frame(minWidth: 320, minHeight: 240)
    }
}

#Preview {
    ContentView()
}
