import SwiftUI
import WebKit

final class FleetWebViewModel: ObservableObject {
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var isLoading = true
    @Published var errorMessage: String?

    weak var webView: WKWebView?

    func goBack() {
        webView?.goBack()
    }

    func goForward() {
        webView?.goForward()
    }

    func reload() {
        errorMessage = nil
        webView?.reload()
    }

    func openInSafari() {
        UIApplication.shared.open(AppConfig.baseURL)
    }

    func syncState(with webView: WKWebView) {
        self.webView = webView
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        isLoading = webView.isLoading
    }
}

struct FleetWebView: UIViewRepresentable {
    let url: URL
    @ObservedObject var viewModel: FleetWebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black

        let request = URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData)
        webView.load(request)
        viewModel.webView = webView

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        viewModel.syncState(with: webView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let viewModel: FleetWebViewModel

        init(viewModel: FleetWebViewModel) {
            self.viewModel = viewModel
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            viewModel.errorMessage = nil
            viewModel.syncState(with: webView)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            viewModel.errorMessage = nil
            viewModel.syncState(with: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            viewModel.errorMessage = error.localizedDescription
            viewModel.syncState(with: webView)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            viewModel.errorMessage = error.localizedDescription
            viewModel.syncState(with: webView)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            viewModel.syncState(with: webView)
            return .allow
        }
    }
}
