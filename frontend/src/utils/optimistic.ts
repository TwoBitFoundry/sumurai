export type SetList<T> = React.Dispatch<React.SetStateAction<T[]>>

// Generic optimistic create helper: push temp, call create, reconcile by id; rollback on error
export async function optimisticCreate<T extends { id: string }>(
  setList: SetList<T>,
  tempItem: T,
  createFn: () => Promise<T>
): Promise<void> {
  // Add temp item
  setList(prev => [...prev, tempItem])
  try {
    const created = await createFn()
    // Replace temp with server item
    setList(prev => prev.map(item => (item.id === tempItem.id ? created : item)))
  } catch (e) {
    // Rollback
    setList(prev => prev.filter(item => item.id !== tempItem.id))
    throw e
  }
}

// Generic optimistic update helper: apply local transform, call update, reconcile or rollback
export async function optimisticUpdate<T extends { id: string }>(
  setList: SetList<T>,
  id: string,
  applyLocal: (item: T) => T,
  updateFn: () => Promise<T>
): Promise<void> {
  let snapshot: T[] = []
  setList(prev => {
    snapshot = prev
    return prev.map(item => (item.id === id ? applyLocal(item) : item))
  })
  try {
    const updated = await updateFn()
    setList(prev => prev.map(item => (item.id === id ? updated : item)))
  } catch (e) {
    setList(snapshot)
    throw e
  }
}

// Generic optimistic delete helper: remove locally, call delete, rollback on error
export async function optimisticDelete<T extends { id: string }>(
  setList: SetList<T>,
  id: string,
  deleteFn: () => Promise<void>
): Promise<void> {
  let snapshot: T[] = []
  setList(prev => {
    snapshot = prev
    return prev.filter(item => item.id !== id)
  })
  try {
    await deleteFn()
  } catch (e) {
    setList(snapshot)
    throw e
  }
}
