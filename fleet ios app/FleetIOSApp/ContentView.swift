import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = FleetWebViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                FleetWebView(url: AppConfig.baseURL, viewModel: viewModel)
                    .ignoresSafeArea(edges: .bottom)

                if viewModel.isLoading {
                    loadingOverlay
                }

                if let errorMessage = viewModel.errorMessage {
                    errorOverlay(message: errorMessage)
                }
            }
            .navigationTitle(AppConfig.appName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar, .bottomBar)
            .toolbarBackground(Color.black, for: .navigationBar, .bottomBar)
            .toolbarColorScheme(.dark, for: .navigationBar, .bottomBar)
            .preferredColorScheme(.dark)
            .toolbar {
                ToolbarItemGroup(placement: .bottomBar) {
                    Button {
                        viewModel.goBack()
                    } label: {
                        Image(systemName: "chevron.left")
                    }
                    .disabled(!viewModel.canGoBack)

                    Button {
                        viewModel.goForward()
                    } label: {
                        Image(systemName: "chevron.right")
                    }
                    .disabled(!viewModel.canGoForward)

                    Spacer()

                    Button {
                        viewModel.reload()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }

                    Button {
                        viewModel.openInSafari()
                    } label: {
                        Image(systemName: "safari")
                    }
                }
            }
        }
    }

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.65)
                .ignoresSafeArea()

            VStack(spacing: 18) {
                Image("BrandMark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 84, height: 84)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .shadow(color: Color.black.opacity(0.35), radius: 18, y: 8)

                VStack(spacing: 6) {
                    Text(AppConfig.appName)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(Color(red: 0.85, green: 0.68, blue: 0.24))

                    Text("Loading your dealership workspace…")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.72))
                }

                ProgressView()
                    .tint(Color(red: 0.85, green: 0.68, blue: 0.24))
                    .scaleEffect(1.2)
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 24)
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(Color(red: 0.10, green: 0.10, blue: 0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
            .padding(24)
        }
    }

    private func errorOverlay(message: String) -> some View {
        ZStack {
            Color.black.opacity(0.72)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(Color(red: 0.85, green: 0.68, blue: 0.24))

                VStack(spacing: 8) {
                    Text("Unable to Load Fleet OS")
                        .font(.headline)
                        .foregroundStyle(.white)

                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.72))
                        .multilineTextAlignment(.center)
                }

                HStack(spacing: 12) {
                    Button("Try Again") {
                        viewModel.reload()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.85, green: 0.68, blue: 0.24))

                    Button("Open in Safari") {
                        viewModel.openInSafari()
                    }
                    .buttonStyle(.bordered)
                    .tint(.white)
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Color(red: 0.10, green: 0.10, blue: 0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
            .padding(24)
        }
    }
}
