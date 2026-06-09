import {
  canPersistBackgroundImagesExternally,
  loadBackgroundImagesExternally,
} from '@/lib/background-image-storage'

describe('background image external storage fallback', () => {
  it('reports unavailable when indexedDB does not exist', () => {
    expect(canPersistBackgroundImagesExternally()).toBe(false)
  })

  it('returns images unchanged when external storage is unavailable', async () => {
    const images = {
      bg1: {
        id: 'bg1' as any,
        name: 'plan.png',
        dataUrl: '',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        opacity: 1,
        locked: false,
        visible: true,
        order: 0,
      },
    }

    await expect(loadBackgroundImagesExternally(images)).resolves.toEqual(images)
  })
})
