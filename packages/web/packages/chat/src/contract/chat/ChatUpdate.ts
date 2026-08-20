export type ChatUpdate =
  | { readonly kind: 'messagesChanged' }
  | { readonly kind: 'participantsChanged' }
  | { readonly kind: 'typingChanged' }
  | { readonly kind: 'readMarkersChanged' }
  | { readonly kind: 'activeDraftsChanged' }
  | { readonly kind: 'activeCommandsChanged' }
  | { readonly kind: 'pendingPermissionsChanged' }
  | { readonly kind: 'pendingWidgetsChanged' }
  | { readonly kind: 'displayConfigChanged' }
  | { readonly kind: 'error'; readonly message: string }
