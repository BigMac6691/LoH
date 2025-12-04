# Typical flow of events

1. AssetManager
   - emits 
      - system:assetLoading
      - system:assetLoaded for success and failure
      - system:allAssetsLoaded when there are no pending assets being loaded
   - listens
      - none
1. SystemEventHandler
   - emits
      - system:systemReady when all assets are loaded and no user has logged in
   - listens
      - system:allAssetsLoaded
1. UIController
   - emits
      - none
   - listens
      - system:assetLoading
      - system:assetLoaded
1. SplashScreen
   - emits
      - none
   - listens
      - system:systemReady triggers switch to login panel


|Source Event|Response Event|Notes|
|------------|--------------|-----|
|system:assetLoading|none|Asset loading progress|
|system:assetLoaded|none|Asset loading result, success or failure|
|system:allAssetsLoaded|none|When there are no loading assets|
|system:systemReady|none|When all assets are loaded but no user logged in|
|system:loginRequest|system:loginResponse|Response will indicate success or failure|
