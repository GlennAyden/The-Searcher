import os
import requests
from typing import Dict, Optional

class LLMService:
    """
    Service for generating AI-powered analyst insights using local Ollama.
    Model-agnostic design for easy swapping between models.
    """
    def __init__(self, model_name: Optional[str] = None):
        # Default to llama3.2, but allow override via env var or parameter
        self.model_name = model_name or os.getenv("LLM_MODEL", "llama3.2:latest")
        self.ollama_url = "http://localhost:11434/api/generate"
        self.temperature = 0.7
        self.max_tokens = 300
    
    def generate_analyst_insight(self, context: Dict) -> str:
        """
        Generate natural language insight for a stock forecast.
        
        Args:
            context: Dictionary containing:
                - symbol: Stock ticker
                - current_price: Current price
                - action: Buy/Sell/Wait recommendation
                - support/resistance: Key levels
                - flow_summary: NeoBDM flow data
                - success_probability: Win probability
                - entry_zone, targets, stop_loss: Trade plan
        
        Returns:
            3-4 sentence analyst insight in Indonesian
        """
        try:
            prompt = self._build_prompt(context)
            
            response = requests.post(
                self.ollama_url,
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": self.temperature,
                        "num_predict": self.max_tokens
                    }
                },
                timeout=30  # 30 second timeout
            )
            
            if response.status_code == 200:
                return response.json().get("response", "").strip()
            else:
                print(f"Ollama error: {response.status_code} - {response.text}")
                return self._fallback_insight(context)
                
        except requests.exceptions.ConnectionError:
            print("Ollama connection failed - service might be offline")
            return self._fallback_insight(context)
        except Exception as e:
            print(f"LLM generation error: {e}")
            return self._fallback_insight(context)
    
    def _build_prompt(self, ctx: Dict) -> str:
        """
        Build structured prompt for financial analyst persona.
        Optimized for Llama 3.2 (will work with Phinance-Phi too).
        """
        # Calculate distance percentage
        dist_pct = ctx.get("distance_to_support", 0)
        
        # Format numbers with Indonesian thousand separators
        price_fmt = f"{int(ctx['current_price']):,}".replace(',', '.')
        support_fmt = f"{int(ctx['support']):,}".replace(',', '.')
        resistance_fmt = f"{int(ctx['resistance']):,}".replace(',', '.')
        target1_fmt = f"{int(ctx['targets'][0]):,}".replace(',', '.')
        sl_fmt = f"{int(ctx['stop_loss']):,}".replace(',', '.')
        
        prompt = f"""ROLE: Kamu adalah analis saham profesional Indonesia dengan keahlian di analisa teknikal dan money flow.

CONTEXT:
- Saham: {ctx['symbol']}
- Harga Saat Ini: Rp {price_fmt}
- Rekomendasi: {ctx['action']}
- Support Level: Rp {support_fmt} (jarak {dist_pct:.1f}%)
- Resistance Level: Rp {resistance_fmt}
- NeoBDM Flow: {ctx['flow_summary']}
- Probabilitas Sukses: {ctx['success_probability']}%
- Entry Zone: Rp {int(ctx['entry_zone']['low']):,} - {int(ctx['entry_zone']['high']):,}
- Target: Rp {target1_fmt}
- Stop Loss: Rp {sl_fmt}

TASK:
Tulis insight 3-4 kalimat yang menjelaskan:
1. KENAPA setup ini menarik (gabungkan flow + technical)
2. APA yang BISA BENAR jika bullish
3. RISIKO apa yang harus diwaspadai

STYLE:
- Bahasa Indonesia profesional tapi conversational
- Langsung to-the-point, tanpa intro/outro
- Sebutkan angka penting (support, target, flow) untuk kredibilitas
- Jangan terlalu optimis atau pesimis, balanced view

CONTOH OUTPUT:
"BBCA sedang dalam fase akumulasi yang menarik. Data NeoBDM menunjukkan net buy Rp 15.2B dalam 5 hari terakhir, mengindikasikan minat asing yang kuat di area support 7.850. Jika harga berhasil bertahan di atas level ini dengan volume konsisten, target 8.400 sangat realistis. Namun, waspadai jika terjadi profit-taking mendadak yang bisa menekan harga kembali ke 7.650."

SEKARANG, TULIS INSIGHT UNTUK {ctx['symbol']}:"""
        
        return prompt
    
    def _fallback_insight(self, ctx: Dict) -> str:
        """
        Fallback insight when LLM is unavailable.
        Simple template-based response.
        """
        action_map = {
            "BUY_ON_WEAKNESS": "buy on weakness",
            "BUY_ON_BREAKOUT": "buy on breakout",
            "WAIT": "menunggu"
        }
        
        action_indo = action_map.get(ctx['action'], ctx['action'])
        
        return f"""Analisa teknikal untuk {ctx['symbol']} menunjukkan rekomendasi {action_indo} dengan probabilitas sukses {ctx['success_probability']}%. 
Level support penting berada di Rp {int(ctx['support']):,}, sementara target pertama di Rp {int(ctx['targets'][0]):,}. 
Perhatikan flow NeoBDM: {ctx['flow_summary']}. Stop loss disarankan di Rp {int(ctx['stop_loss']):,} untuk manajemen risiko optimal."""
