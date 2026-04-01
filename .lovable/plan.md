

# Make Fullscreen & Pop-out Buttons Visible

## Problem
The fullscreen (`Maximize2`) and pop-out (`ExternalLink`) buttons exist but are ghost icon-only buttons that blend into the toolbar and may be hard to spot or hidden behind the dialog's default close button.

## Solution
Move these buttons to sit directly next to the Refresh button with matching styling (`variant="ghost" size="sm"` with text labels), so they're clearly visible and consistent with the Refresh button style.

## Changes

**File: `src/components/ContactsMapDialog.tsx`** (lines 83-92)

Replace the current icon-only fullscreen/pop-out buttons and reorder them to appear right next to Refresh:

```tsx
<div className="flex items-center gap-2">
  <Button variant="ghost" size="sm" onClick={startGeocoding} disabled={isLoading}>
    <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
    Refresh
  </Button>
  <Button variant="ghost" size="sm" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
    {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
    {isFullscreen ? "Exit" : "Fullscreen"}
  </Button>
  <Button variant="ghost" size="sm" onClick={openPopout} title="Open in new window">
    <ExternalLink className="h-4 w-4 mr-1" />
    Pop Out
  </Button>
  {/* ... rest of controls (failed, H3 toggle, resolution) */}
</div>
```

This gives all three buttons the same visual treatment with text labels so they're easy to find.

