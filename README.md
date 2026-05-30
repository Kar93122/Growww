# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## 5. Challenges & Solutions

**Challenge:** Database silent failures for older user accounts missing required documents.
**Solution:** Upgraded Firestore write operations from `batch.update()` to `batch.set({ merge: true })`, ensuring the system dynamically self-heals and initializes missing documents on the fly.

**Challenge:** UI latency during database updates.
**Solution:** Refactored event handlers from synchronous blocking functions to fire-and-forget asynchronous promises, drastically improving perceived performance.

**Challenge:** Hard page reloads causing poor UX during profile updates.
**Solution:** Implemented real-time context synchronization. Updating a profile now silently updates Firestore, which triggers an `onSnapshot` event that instantly updates the React DOM without a browser reload.
