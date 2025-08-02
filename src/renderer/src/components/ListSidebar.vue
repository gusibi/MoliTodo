<template>
  <!-- 清单分组标题 -->
  <div class="nav-section-title">我的清单</div>

  <!-- 清单项直接输出，不包装额外容器 -->
  <template v-for="list in sortedLists" :key="list.id">
    <div class="nav-item"
      :class="{ active: currentListId === list.id, 'is-default': list.isDefault, 'has-tasks': getListTaskCount(list.id) > 0 }"
      @click="selectList(list.id)" @contextmenu.prevent="showListContextMenu(list, $event)">
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
        <span>重命名</span>
      </div>
      <div class="nav-context-item" @click="duplicateList(contextMenuList)">
        <i class="fas fa-copy"></i>
        <span>复制清单</span>
      </div>
      <div class="nav-context-divider"></div>
      <div class="nav-context-item danger" @click="deleteList(contextMenuList)"
        :class="{ disabled: contextMenuList?.isDefault }">
        <i class="fas fa-trash"></i>
        <span>删除清单</span>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteDialog" class="nav-modal-overlay" @click="closeDeleteDialog">
      <div class="nav-delete-dialog" @click.stop>
        <div class="nav-dialog-header">
          <h3>删除清单</h3>
        </div>
        <div class="nav-dialog-body">
          <p>确定要删除清单 "{{ deletingList?.name }}" 吗？</p>
          <p v-if="getListTaskCount(deletingList?.id) > 0" class="nav-warning-text">
            该清单中有 {{ getListTaskCount(deletingList?.id) }} 个任务，请选择处理方式：
          </p>
          <div v-if="getListTaskCount(deletingList?.id) > 0" class="nav-task-handling-options">
            <label class="nav-radio-option">
              <input type="radio" v-model="taskHandling" value="move" />
              <span>移动到默认清单</span>
            </label>
            <label class="nav-radio-option">
              <input type="radio" v-model="taskHandling" value="delete" />
              <span class="nav-danger-text">同时删除所有任务</span>
            </label>
          </div>
        </div>
        <div class="nav-dialog-footer">
          <button class="nav-btn-cancel" @click="closeDeleteDialog">取消</button>
          <button class="nav-btn-danger" @click="confirmDeleteList"
            :disabled="getListTaskCount(deletingList?.id) > 0 && !taskHandling">删除</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, defineExpose } from 'vue'
import { useTaskStore } from '../store/taskStore'
import ListCreateDialog from './ListCreateDialog.vue'

export default {
  name: 'ListSidebar',
  components: {
    ListCreateDialog
  },
  setup() {
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

    // 计算属性
    const currentCategory = computed(() => taskStore.currentCategory)
    const currentListId = computed(() => taskStore.currentListId)
    const sortedLists = computed(() => taskStore.sortedLists)
    const categoryCounts = computed(() => taskStore.categoryCounts)
    const listTaskCounts = computed(() => taskStore.listTaskCounts)

    // 方法
    const getListIconClass = (icon) => {
      const iconMap = {
        'list': 'fas fa-list',
        'inbox': 'fas fa-inbox',
        'star': 'fas fa-star',
        'heart': 'fas fa-heart',
        'bookmark': 'fas fa-bookmark',
        'flag': 'fas fa-flag',
        'folder': 'fas fa-folder',
        'briefcase': 'fas fa-briefcase',
        'home': 'fas fa-home',
        'user': 'fas fa-user',
        'calendar': 'fas fa-calendar',
        'clock': 'fas fa-clock',
        'target': 'fas fa-bullseye',
        'trophy': 'fas fa-trophy',
        'book': 'fas fa-book',
        'music': 'fas fa-music'
      }
      return iconMap[icon] || 'fas fa-list'
    }

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
        const newName = `${list.name} 副本`
        await taskStore.createList(newName, list.color, list.icon)
        closeContextMenu()
      } catch (error) {
        console.error('复制清单失败:', error)
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
        console.error('删除清单失败:', error)
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
        }
        closeCreateDialog()
      } catch (error) {
        console.error('操作清单失败:', error)
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
      console.log("Opening create dialog from ListSidebar")
      showCreateDialog.value = true
      console.log("Opening create dialog from ListSidebar", showCreateDialog.value)
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
      openCreateDialog
    }
  }
}

</script>
<style scoped>
@import '../assets/styles/components/sidebar-nav.css';
</style>