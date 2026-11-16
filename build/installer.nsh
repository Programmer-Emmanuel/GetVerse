!macro customInstall
  CreateShortCut "$SMPROGRAMS\GetVerse\Désinstaller GetVerse.lnk" "$INSTDIR\${UNINSTALL_FILENAME}"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\GetVerse\Désinstaller GetVerse.lnk"
  RMDir "$SMPROGRAMS\GetVerse"
!macroend
