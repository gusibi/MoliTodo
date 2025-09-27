<template>
  <!-- 清单分组标题 -->
  <div class="nav-section-title">{{ $t('lists.myLists') }}</div>

  <!-- 清单项直接输出，不包装额外容器 -->
  <template v-for="list in sortedLists" :key="list.id">
    <div class="nav-item"
      :class="{ 
        active: currentListId === list.id, 
        'is-default': list.isDefault, 
        'has-tasks': getListTaskCount(list.id) > 0,
        'drag-over': dragOverListId === list.id
      }"
      @click="selectList(list.id)" 
      @contextmenu.prevent="showListContextMenu(list, $event)"
      @dragover.prevent="handleDragOver($event, list.id)"
      @dragleave="handleDragLeave"
      @drop="handleDrop($event, list.id)">
      <i :class="getListIconClass(list.icon)" :style="{ color: list.color }"></i>
      <span>{{ list.name }}</span>
      <span v-if="getListTaskCount(list.id) > 0" class="nav-count" :class="{ 'has-active': hasActiveTasks(list.id) }">{{
        getListTaskCount(list.id) }}</span>
    </div>
  </template>

  <!-- 使用 Teleport 将弹出元素传送到 body -->
  <Teleport to="body">
    <!-- 清单创建/编辑对话框 -->
    <ListCreateDialog v-if="showCreateDialog" :visible="showCreateDialog" :editing-list="editingList"
      @close="closeCreateDialog" @confirm="handleListCreate" />

    <!-- 清单上下文菜单 -->
    <div v-if="showContextMenu" class="nav-context-menu" :style="contextMenuStyle" @click.stop>
      <div class="nav-context-item" @click="editList(contextMenuList)">
        <i class="fas fa-edit"></i>
        <span>{{ $t('lists.rename') }}</span>
      </div>
      <div class="nav-context-item" @click="duplicateList(contextMenuList)">
        <i class="fas fa-copy"></i>
        <span>{{ $t('lists.duplicate') }}</span>
      </div>
      <div class="nav-context-divider"></div>
      <div class="nav-context-item danger" @click="deleteList(contextMenuList)"
        :class="{ disabled: contextMenuList?.isDefault }">
        <i class="fas fa-trash"></i>
        <span>{{ $t('lists.delete') }}</span>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteDialog" class="nav-modal-overlay" @click="closeDeleteDialog">
      <div class="nav-delete-dialog" @click.stop>
        <div class="nav-dialog-header">
          <h3>{{ $t('lists.deleteTitle') }}</h3>
        </div>
        <div class="nav-dialog-body">
          <p>{{ $t('lists.confirmDelete', { name: deletingList?.name }) }}</p>
          <p v-if="getListTaskCount(deletingList?.id) > 0" class="nav-warning-text">
            {{ $t('lists.hasTasksWarning', { count: getListTaskCount(deletingList?.id) }) }}
          </p>
          <div v-if="getListTaskCount(deletingList?.id) > 0" class="nav-task-handling-options">
            <label class="nav-radio-option">
              <input type="radio" v-model="taskHandling" value="move" />
              <span>{{ $t('lists.moveToDefault') }}</span>
            </label>
            <label class="nav-radio-option">
              <input type="radio" v-model="taskHandling" value="delete" />
              <span class="nav-danger-text">{{ $t('lists.deleteAllTasks') }}</span>
            </label>
          </div>
        </div>
        <div class="nav-dialog-footer">
          <button class="nav-btn-cancel" @click="closeDeleteDialog">{{ $t('common.cancel') }}</button>
          <button class="nav-btn-danger" @click="confirmDeleteList"
            :disabled="getListTaskCount(deletingList?.id) > 0 && !taskHandling">{{ $t('lists.delete') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, defineExpose } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '@/store/taskStore'
import ListCreateDialog from './ListCreateDialog.vue'
import { getListIconClass } from '@/utils/icon-utils'

export default {
  name: 'ListSidebar',
  components: {
    ListCreateDialog
  },
  setup() {
    const { t } = useI18n()
    const taskStore = useTaskStore()

    // 响应式数据
    const showCreateDialog = ref(false)
    const editingList = ref(null)
    const showContextMenu = ref(false)
    const contextMenuList = ref(null)
    const contextMenuStyle = ref({})
    const showDeleteDialog = ref(false)
    const deletingList = ref(null)
    const taskHandling = ref('move')
    
    // 拖拽相关响应式数据
    const dragOverListId = ref(null)

    // 计算属性
    const currentCategory = computed(() => taskStore.currentCategory)
    const currentListId = computed(() => taskStore.currentListId)
    const sortedLists = computed(() => taskStore.sortedLists)
    const categoryCounts = computed(() => taskStore.categoryCounts)
    const listTaskCounts = computed(() => taskStore.listTaskCounts)

    // 方法

    const selectList = (listId) => {
      taskStore.setCurrentListId(listId)
      taskStore.setCurrentCategory('all') // 选择清单时显示该清单的所有任务
    }

    const getListTaskCount = (listId) => {
      return listTaskCounts.value[listId]?.incomplete || 0
    }

    const hasActiveTasks = (listId) => {
      const counts = listTaskCounts.value[listId]
      return counts && (counts.doing > 0 || counts.paused > 0)
    }

    // 拖拽事件处理
    const handleDragOver = (event, listId) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      dragOverListId.value = listId
    }

    const handleDragLeave = () => {
      dragOverListId.value = null
    }

    const handleDrop = async (event, targetListId) => {
      event.preventDefault()
      dragOverListId.value = null
      
      try {
        // 获取拖拽数据
        const dragData = JSON.parse(event.dataTransfer.getData('application/json'))
        const { taskId, currentListId } = dragData
        
        // 如果目标清单与当前清单相同，不执行操作
        if (targetListId === currentListId) {
          return
        }
        
        // 移动任务到目标清单
        const result = await taskStore.moveTaskToList(taskId, targetListId)
        if (result.success) {
          console.log(`任务 ${taskId} 已移动到清单 ${targetListId}`)
        } else {
          console.error('移动任务失败:', result.error)
        }
      } catch (error) {
        console.error('处理拖拽数据失败:', error)
      }
    }

    const showListContextMenu = (list, event) => {
      if (list.isDefault) return // 默认清单不显示上下文菜单

      contextMenuList.value = list
      contextMenuStyle.value = {
        position: 'fixed',
        left: `${event.clientX}px`,
        top: `${event.clientY}px`,
        zIndex: 1000
      }
      showContextMenu.value = true
    }

    const closeContextMenu = () => {
      showContextMenu.value = false
      contextMenuList.value = null
    }

    const editList = (list) => {
      console.log("editList clicked: ", list)
      editingList.value = list
      console.log("editList clicked: ", editingList.value)
      showCreateDialog.value = true
      closeContextMenu()
    }

    const duplicateList = async (list) => {
      try {
        const newName = `${list.name} ${t('lists.copy')}`
        await taskStore.createList(newName, list.color, list.icon)
        closeContextMenu()
      } catch (error) {
        console.error('Failed to duplicate list:', error)
      }
    }

    const deleteList = (list) => {
      if (list.isDefault) return

      deletingList.value = list
      taskHandling.value = 'move'
      showDeleteDialog.value = true
      closeContextMenu()
    }

    const closeDeleteDialog = () => {
      showDeleteDialog.value = false
      deletingList.value = null
      taskHandling.value = 'move'
    }

    const confirmDeleteList = async () => {
      if (!deletingList.value) return

      try {
        await taskStore.deleteList(deletingList.value.id, taskHandling.value)
        closeDeleteDialog()
      } catch (error) {
        console.error('Failed to delete list:', error)
      }
    }

    const closeCreateDialog = () => {
      showCreateDialog.value = false
      editingList.value = null
    }

    const handleListCreate = async (listData) => {
      try {
        if (editingList.value) {
          // 编辑模式
          await taskStore.updateList(editingList.value.id, listData)
        } else {
          // 创建模式
          await taskStore.createList(listData.name, listData.color, listData.icon)
          console.log("handleListCreate result: ", listData)
        }
        closeCreateDialog()
      } catch (error) {
        console.error('Failed to operate list:', error)
      }
    }



    // 点击外部关闭上下文菜单
    const handleClickOutside = (event) => {
      if (showContextMenu.value) {
        closeContextMenu()
      }
    }

    // 生命周期
    onMounted(async () => {
      // 加载清单数据
      await taskStore.getAllLists()

      // 添加全局点击事件监听
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    // 暴露给父组件的方法
    const openCreateDialog = () => {
      // console.log("Opening create dialog from ListSidebar")
      showCreateDialog.value = true
      // console.log("Opening create dialog from ListSidebar", showCreateDialog.value)
    }

    // 使用 defineExpose 暴露方法给父组件
    defineExpose({
      openCreateDialog
    })

    return {
      // 响应式数据
      showCreateDialog,
      editingList,
      showContextMenu,
      contextMenuList,
      contextMenuStyle,
      showDeleteDialog,
      deletingList,
      taskHandling,
      dragOverListId,

      // 计算属性
      currentCategory,
      currentListId,
      sortedLists,

      // 方法
      getListIconClass,
      selectList,
      getListTaskCount,
      hasActiveTasks,
      showListContextMenu,
      editList,
      duplicateList,
      deleteList,
      closeDeleteDialog,
      confirmDeleteList,
      closeCreateDialog,
      handleListCreate,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      openCreateDialog
    }
  }
}

</script>
<style scoped>
@import '@/assets/styles/components/sidebar-nav.css';
</style>