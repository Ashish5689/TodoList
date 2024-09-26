"use client"

import { useState, useEffect, useRef } from "react"
import { PlusIcon, Trash2Icon, PencilIcon, SaveIcon, ChevronDownIcon, ChevronUpIcon, GripVerticalIcon, AlertCircleIcon } from "lucide-react"
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"

interface Task {
  id: number
  text: string
  completed: boolean
  completedAt?: Date
  location?: string
}

// Cache for storing location data
const locationCache: { [key: string]: string } = {}

interface TaskItemProps {
  task: Task;
  index: number;
  editingTask: number | null;
  editText: string;
  setEditText: (text: string) => void;
  toggleComplete: (id: number) => void;
  startEditing: (id: number, text: string) => void;
  saveEdit: (id: number) => void;
  deleteTask: (id: number) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  index, 
  editingTask, 
  editText, 
  setEditText, 
  toggleComplete, 
  startEditing, 
  saveEdit, 
  deleteTask 
}) => {
  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <li
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="flex flex-col bg-white p-4 rounded-lg shadow-md mb-3 transition-all hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div {...provided.dragHandleProps} className="mr-3 cursor-move text-gray-400 hover:text-gray-600">
              <GripVerticalIcon size={20} />
            </div>
            {editingTask === task.id ? (
              <Input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="flex-grow mr-2"
              />
            ) : (
              <div className="flex items-center flex-grow">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleComplete(task.id)}
                  className="mr-3"
                />
                <span
                  className={`flex-grow ${
                    task.completed ? "line-through text-gray-400" : "text-gray-700"
                  }`}
                >
                  {task.text}
                </span>
              </div>
            )}
            <div className="flex space-x-2">
              {editingTask === task.id ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => saveEdit(task.id)}
                  className="text-green-500 hover:text-green-600"
                >
                  <SaveIcon className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startEditing(task.id, task.text)}
                  className="text-blue-500 hover:text-blue-600"
                >
                  <PencilIcon className="h-5 w-5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteTask(task.id)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2Icon className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {task.completed && task.completedAt && (
            <div className="text-sm text-gray-400 mt-2">
              Completed on {task.completedAt.toLocaleString()} at {task.location || "Unknown location"}
            </div>
          )}
        </li>
      )}
    </Draggable>
  );
};

export function TodoListComponent() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState("")
  const [editingTask, setEditingTask] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [aiInput, setAiInput] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [isListExpanded, setIsListExpanded] = useState(true)
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [streamedTasks, setStreamedTasks] = useState<string>("")
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const [generatedTasks, setGeneratedTasks] = useState<string[]>([])

  // Set isClient to true when component mounts
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load tasks from localStorage when the component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTasks = localStorage.getItem('tasks')
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks, (key, value) => {
          if (key === 'completedAt' && value) {
            return new Date(value)
          }
          return value
        }))
      }
    }
  }, [isClient])

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (isClient && tasks.length > 0) {
      localStorage.setItem('tasks', JSON.stringify(tasks))
    }
  }, [tasks, isClient])

  const addTask = () => {
    if (newTask.trim() === "") {
      setError("Please enter a task before adding.")
      return
    }
    setError(null)
    setTasks([...tasks, { id: Date.now(), text: newTask, completed: false }])
    setNewTask("")
  }

  const deleteTask = (id: number) => {
    setTasks(tasks.filter((task) => task.id !== id))
  }

  const toggleComplete = (id: number) => {
    const now = new Date()
    setTasks(tasks.map(task => 
      task.id === id
        ? { ...task, completed: !task.completed, completedAt: !task.completed ? now : undefined }
        : task
    ))

    if (tasks.find(task => task.id === id)?.completed === false) {
      getCurrentLocation().then(location => {
        setTasks(prevTasks => prevTasks.map(task =>
          task.id === id ? { ...task, location } : task
        ))
      })
    }
  }

  const startEditing = (id: number, text: string) => {
    setEditingTask(id)
    setEditText(text)
  }

  const saveEdit = (id: number) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, text: editText } : task
      )
    )
    setEditingTask(null)
  }

  const breakdownActivity = async () => {
    if (aiInput.trim() === "") {
      setError("Please enter an activity to break down.")
      return
    }
    setIsAIProcessing(true)
    setError(null)
    setStreamedTasks("")

    try {
      const response = await fetch('/api/breakdown-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activity: aiInput }),
      })

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error(`API request failed: ${errorText}`);
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader!.read()
        if (done) {
          break
        }
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        const parsedLines = lines
          .map(line => line.replace(/^data: /, '').trim())
          .filter(line => line !== '' && line !== '[DONE]')
          .map(line => {
            try {
              return JSON.parse(line)
            } catch (e) {
              return null
            }
          })
          .filter(line => line)
          .map(line => line.choices[0].delta.content)
          .join('')

        setStreamedTasks(prev => prev + parsedLines)
      }

      const newTasks = streamedTasks.split('\n').filter(task => task.trim() !== '')
      setGeneratedTasks(newTasks)
      setAiInput("")
    } catch (error) {
      console.error("Error breaking down activity:", error)
      setError("An error occurred while breaking down the activity. Please try again.")
    } finally {
      setIsAIProcessing(false)
    }
  }

  const addGeneratedTasksToTodoList = () => {
    const newTasks = generatedTasks.map(task => ({
      id: Date.now() + Math.random(),
      text: task.replace(/^\d+\.\s*/, '').trim(),
      completed: false,
    }))
    setTasks(prevTasks => [...prevTasks, ...newTasks])
    setGeneratedTasks([])
    setStreamedTasks("")
  }

  const getCurrentLocation = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve("Geolocation not supported")
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`

          if (locationCache[cacheKey]) {
            resolve(locationCache[cacheKey])
            return
          }

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            )
            const data = await response.json()
            const city = data.address.city || data.address.town || data.address.village || "Unknown city"
            locationCache[cacheKey] = city
            resolve(city)
          } catch (error) {
            console.error("Error fetching location name:", error)
            resolve(`Lat: ${latitude.toFixed(2)}, Long: ${longitude.toFixed(2)}`)
          }
        },
        () => {
          resolve("Unable to retrieve location")
        }
      )
    })
  }

  const toggleShowAllTasks = () => {
    setShowAllTasks(!showAllTasks)
  }

  const toggleListExpansion = () => {
    setIsListExpanded(!isListExpanded)
  }

  const visibleTasks = showAllTasks ? tasks : tasks.slice(-4)

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTasks(items);
  }

  const deleteAllTasks = () => {
    setTasks([]);
    localStorage.removeItem('tasks');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-6">
          <h1 className="text-3xl font-bold text-white mb-4">AI-Powered Todo List</h1>
          <div className="flex space-x-2">
            <Input
              type="text"
              value={newTask}
              onChange={(e) => {
                setNewTask(e.target.value)
                setError(null)
              }}
              placeholder="Add a new task"
              className="flex-grow"
            />
            <Button onClick={addTask} className="bg-white text-purple-500 hover:bg-purple-100">
              <PlusIcon className="h-5 w-5 mr-2" />
              Add
            </Button>
            <Button onClick={deleteAllTasks} className="bg-red-500 text-white hover:bg-red-600">
              <Trash2Icon className="h-5 w-5 mr-2" />
              Delete All
            </Button>
          </div>
          {error && (
            <div className="flex items-center mt-2 text-yellow-300 font-semibold">
              <AlertCircleIcon className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-700">Tasks</h2>
            <Button variant="ghost" size="sm" onClick={toggleListExpansion} className="text-gray-500 hover:text-gray-700">
              {isListExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
            </Button>
          </div>
          {isListExpanded && (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="tasks">
                {(provided) => (
                  <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                    {visibleTasks.map((task, index) => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        index={index}
                        editingTask={editingTask}
                        editText={editText}
                        setEditText={setEditText}
                        toggleComplete={toggleComplete}
                        startEditing={startEditing}
                        saveEdit={saveEdit}
                        deleteTask={deleteTask}
                      />
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          )}
          {tasks.length > 4 && (
            <Button
              variant="link"
              onClick={toggleShowAllTasks}
              className="mt-4 text-purple-500 hover:text-purple-600"
            >
              {showAllTasks ? "Show Less" : "Show More"}
            </Button>
          )}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">AI Task Breakdown</h2>
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Enter an activity to break down into tasks"
              className="mb-4"
            />
            <Button onClick={breakdownActivity} className="bg-purple-500 text-white hover:bg-purple-600" disabled={isAIProcessing}>
              {isAIProcessing ? "Processing..." : "Break Down Activity"}
            </Button>
            {streamedTasks && (
              <div className="mt-4 p-4 bg-gray-100 rounded-md">
                <h3 className="font-semibold mb-2">Generated Tasks:</h3>
                <pre className="whitespace-pre-wrap">{streamedTasks}</pre>
                {generatedTasks.length > 0 && (
                  <Button
                    onClick={addGeneratedTasksToTodoList}
                    className="mt-4 bg-green-500 text-white hover:bg-green-600"
                  >
                    Add Generated Tasks to Todo List
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}