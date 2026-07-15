import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private weak var status: NSTextField?
    func applicationDidFinishLaunching(_ notification: Notification) {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 520, height: 360), styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.title = "Open Computer Use Fixture"
        let content = NSView(frame: window.contentView!.bounds)
        content.autoresizingMask = [.width, .height]

        let input = NSTextField(string: "fixture")
        input.identifier = NSUserInterfaceItemIdentifier("fixture-input")
        input.frame = NSRect(x: 24, y: 292, width: 260, height: 28)
        content.addSubview(input)

        let status = NSTextField(labelWithString: "ready")
        status.identifier = NSUserInterfaceItemIdentifier("fixture-status")
        status.frame = NSRect(x: 24, y: 246, width: 260, height: 24)
        content.addSubview(status)
		self.status = status

        let button = NSButton(title: "Toggle status", target: nil, action: nil)
        button.identifier = NSUserInterfaceItemIdentifier("fixture-toggle")
        button.frame = NSRect(x: 300, y: 290, width: 160, height: 30)
        button.action = #selector(toggleStatus(_:))
        button.target = self
        content.addSubview(button)

        let scroll = NSScrollView(frame: NSRect(x: 24, y: 24, width: 436, height: 196))
        scroll.hasVerticalScroller = true
        let document = NSTextView(frame: NSRect(x: 0, y: 0, width: 416, height: 800))
        document.isEditable = false
        document.string = (1...80).map { "Fixture line \($0)" }.joined(separator: "\n")
        scroll.documentView = document
        content.addSubview(scroll)

        window.contentView = content
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func toggleStatus(_ sender: NSButton) {
		guard let status else { return }
        status.stringValue = status.stringValue == "ready" ? "completed" : "ready"
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
