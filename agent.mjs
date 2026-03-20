/**
 * Agent + Function Calling 示例
 * 使用 LangChain + 智谱 GLM
 * 
 * 运行方式: 
 * export PATH=$HOME/.n/bin:$PATH
 * node agent.js "如果明天天气好，就早上8点提醒我去跑步"
 */

import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

// ============ 配置 ============
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || '你的智谱API密钥';
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

// ============ Mock 函数实现 ============

/**
 * 获取天气 - Mock 实现
 * 随机返回天气状况
 */
function getWeatherMock(location, date) {
  const weatherTypes = ['晴天', '多云', '阴天', '小雨', '大雨', '雪'];
  const temperatures = [15, 18, 22, 25, 28, 30, 32];
  
  const weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
  const temp = temperatures[Math.floor(Math.random() * temperatures.length)];
  
  // 判断是否是"好天气"
  const isGoodWeather = ['晴天', '多云'].includes(weather) && temp >= 18 && temp <= 30;
  
  return {
    location,
    date,
    weather,
    temperature: `${temp}°C`,
    isGoodWeather,
    description: `${location}${date}的天气是${weather}，温度${temp}°C，${isGoodWeather ? '适合户外活动' : '不太适合户外活动'}`
  };
}

/**
 * 设置提醒 - Mock 实现
 * 模拟设置提醒功能
 */
const reminders = [];

function setReminderMock(time, content, condition = null) {
  const reminder = {
    id: reminders.length + 1,
    time,
    content,
    condition,
    createdAt: new Date().toISOString(),
    status: 'scheduled'
  };
  
  reminders.push(reminder);
  
  return {
    success: true,
    reminder,
    message: condition 
      ? `已设置条件提醒：当${condition}时，将在${time}提醒您"${content}"`
      : `已设置提醒：${time} - ${content}`
  };
}

// ============ LangChain Tools 定义 ============

const getWeatherTool = tool(
  async ({ location, date }) => {
    console.log(`\n🌤️  [调用工具] 获取天气: ${location}, ${date}`);
    const result = getWeatherMock(location, date);
    console.log(`   结果: ${result.description}`);
    return JSON.stringify(result);
  },
  {
    name: 'get_weather',
    description: '获取指定地点和日期的天气信息。可以查询今天、明天或具体日期的天气。',
    schema: z.object({
      location: z.string().describe('地点，如"北京"、"上海"，默认为"当前位置"'),
      date: z.string().describe('日期，如"今天"、"明天"、"2024-03-20"')
    })
  }
);

const setReminderTool = tool(
  async ({ time, content, condition }) => {
    console.log(`\n⏰  [调用工具] 设置提醒: ${time}, ${content}${condition ? `, 条件: ${condition}` : ''}`);
    const result = setReminderMock(time, content, condition);
    console.log(`   结果: ${result.message}`);
    return JSON.stringify(result);
  },
  {
    name: 'set_reminder',
    description: '设置提醒。可以设置定时提醒，也可以设置条件提醒（如天气好时提醒）。',
    schema: z.object({
      time: z.string().describe('提醒时间，如"早上8点"、"明天下午3点"、"2024-03-20 09:00"'),
      content: z.string().describe('提醒内容，如"去跑步"、"开会"'),
      condition: z.string().optional().describe('可选的触发条件，如"天气好"、"温度超过25度"')
    })
  }
);

const tools = [getWeatherTool, setReminderTool];

// ============ 日志工具 ============

function formatMessage(msg) {
  if (msg instanceof SystemMessage) {
    return { role: 'system', content: msg.content };
  } else if (msg instanceof HumanMessage) {
    return { role: 'user', content: msg.content };
  } else if (msg instanceof AIMessage) {
    return { 
      role: 'assistant', 
      content: msg.content,
      tool_calls: msg.tool_calls || []
    };
  } else if (msg.role === 'tool') {
    return { role: 'tool', tool_call_id: msg.tool_call_id, content: msg.content };
  }
  return msg;
}

function printMessages(messages, title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📨 ${title}`);
  console.log(`${'─'.repeat(60)}`);
  messages.forEach((msg, idx) => {
    const formatted = formatMessage(msg);
    console.log(`\n[${idx}] Role: ${formatted.role}`);
    if (formatted.content) {
      const content = typeof formatted.content === 'string' 
        ? formatted.content.substring(0, 500) + (formatted.content.length > 500 ? '...(截断)' : '')
        : JSON.stringify(formatted.content);
      console.log(`    Content: ${content}`);
    }
    if (formatted.tool_calls && formatted.tool_calls.length > 0) {
      console.log(`    Tool Calls: ${JSON.stringify(formatted.tool_calls, null, 2)}`);
    }
    if (formatted.tool_call_id) {
      console.log(`    Tool Call ID: ${formatted.tool_call_id}`);
    }
  });
  console.log(`${'─'.repeat(60)}`);
}

function printResponse(response, title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🤖 ${title}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Content: ${response.content || '(无文本内容)'}`);
  if (response.tool_calls && response.tool_calls.length > 0) {
    console.log(`\nTool Calls (${response.tool_calls.length} 个):`);
    response.tool_calls.forEach((tc, idx) => {
      console.log(`  [${idx}] ${tc.name}`);
      console.log(`      ID: ${tc.id}`);
      console.log(`      Args: ${JSON.stringify(tc.args)}`);
    });
  }
  console.log(`${'═'.repeat(60)}`);
}

// ============ Agent 实现 ============

class ZhipuAgent {
  constructor() {
    // 使用智谱 GLM-4 模型（兼容 OpenAI 格式）
    this.model = new ChatOpenAI({
      model: 'glm-4',
      apiKey: ZHIPU_API_KEY,
      configuration: {
        baseURL: ZHIPU_BASE_URL
      },
      temperature: 0.7
    });
    
    // 绑定工具到模型
    this.modelWithTools = this.model.bindTools(tools);
    
    this.systemPrompt = `你是一个智能助手，可以帮助用户查询天气和设置提醒。

你有以下能力：
1. 获取天气信息（get_weather）：可以查询任意地点和日期的天气
2. 设置提醒（set_reminder）：可以设置定时提醒或条件提醒

处理用户请求时，请按照以下步骤：
1. 理解用户意图
2. 如果需要，先调用工具获取必要信息（如天气）
3. 根据获取的信息决定下一步操作
4. 如果是条件性请求（如"如果天气好就..."），先查询条件，再根据结果执行

请用中文回复用户。`;
  }
  
  async run(query) {
    console.log('\n' + '='.repeat(60));
    console.log(`📝 用户输入: ${query}`);
    console.log('='.repeat(60));
    
    const messages = [
      new SystemMessage(this.systemPrompt),
      new HumanMessage(query)
    ];
    
    let iterations = 0;
    const maxIterations = 5;
    
    while (iterations < maxIterations) {
      iterations++;
      console.log(`\n${'#'.repeat(60)}`);
      console.log(`# 迭代 ${iterations}`);
      console.log(`${'#'.repeat(60)}`);
      
      // 打印模型输入
      printMessages(messages, `模型输入 (共 ${messages.length} 条消息)`);
      
      // 调用模型
      console.log('\n⏳ 正在调用模型...');
      const response = await this.modelWithTools.invoke(messages);
      
      // 打印模型输出
      printResponse(response, '模型输出');
      
      messages.push(response);
      
      // 检查是否有工具调用
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`\n🔧 执行 ${response.tool_calls.length} 个工具调用...`);
        
        // 执行所有工具调用
        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.name;
          const toolArgs = toolCall.args;
          
          // 找到对应的工具并执行
          const toolToUse = tools.find(t => t.name === toolName);
          if (toolToUse) {
            const toolResult = await toolToUse.invoke(toolArgs);
            
            console.log(`\n📥 工具返回结果:`);
            console.log(`   Tool: ${toolName}`);
            console.log(`   Result: ${toolResult}`);
            
            // 将工具结果添加到消息中
            messages.push({
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id
            });
          }
        }
      } else {
        // 没有工具调用，返回最终回复
        console.log('\n' + '='.repeat(60));
        console.log('✅ 最终回复:');
        console.log('='.repeat(60));
        console.log(response.content);
        console.log('='.repeat(60));
        
        return {
          success: true,
          response: response.content,
          reminders: reminders
        };
      }
    }
    
    return {
      success: false,
      error: '达到最大迭代次数',
      reminders: reminders
    };
  }
}

// ============ 主程序 ============

async function main() {
  const query = process.argv[2] || '如果明天天气好，就早上8点提醒我去跑步';
  
  console.log('\n🚀 启动智能助手 Agent');
  console.log('📌 使用模型: 智谱 GLM-4');
  console.log('🔧 可用工具: get_weather, set_reminder\n');
  
  const agent = new ZhipuAgent();
  
  try {
    const result = await agent.run(query);
    
    if (result.success) {
      console.log('\n📋 当前提醒列表:');
      if (result.reminders.length > 0) {
        result.reminders.forEach(r => {
          console.log(`  - [${r.id}] ${r.time}: ${r.content}${r.condition ? ` (条件: ${r.condition})` : ''}`);
        });
      } else {
        console.log('  (暂无提醒)');
      }
    } else {
      console.error('❌ 执行失败:', result.error);
    }
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 提示: 请设置智谱 API 密钥');
      console.log('   export ZHIPU_API_KEY="你的API密钥"');
      console.log('   或修改 agent.js 中的 ZHIPU_API_KEY 变量');
    }
  }
}

main();
