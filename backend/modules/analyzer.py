import torch
from transformers import pipeline
from tqdm import tqdm
import json
import os
import time
import datetime
import config

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        return super().default(obj)

class SentimentEngine:
    def __init__(self):
        # 1. Force GPU & FP16 if available
        self.device = 0 if torch.cuda.is_available() else -1
        self.dtype = torch.float16 if self.device == 0 else torch.float32
        
        print(f"[*] Initializing Sentiment Model on {'GPU' if self.device==0 else 'CPU'}...")
        if self.device == 0:
            print("    -> Using FP16 Precision for Speed")
        
        self.classifier = pipeline(
            "zero-shot-classification", 
            model=config.MODEL_NAME, 
            device=self.device,
            torch_dtype=self.dtype
        )

    def chunk_text(self, text, max_len=512, overlap=50):
        """Splits text into chunks with overlap."""
        if len(text) <= max_len:
            return [text]
        
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + max_len, len(text))
            chunks.append(text[start:end])
            if end == len(text):
                break
            start += (max_len - overlap)
        return chunks

    def prepare_chunks(self, title, text):
        """
        Prepares chunks for a single article but DOES NOT run inference.
        Returns a list of chunk strings.
        """
        if not text: text = ""
        if not title: title = ""

        # Combine Title + Text
        combined_text = f"{title}. {text}"
        
        # Split into chunks
        chunks = self.chunk_text(combined_text, max_len=config.MAX_LENGTH)
        return chunks

    def process_and_save(self, news_data=None):
        """
        Runs analysis using BATCH PROCESSING.
        """
        if news_data is None:
            if os.path.exists(config.NEWS_DATA_FILE):
                with open(config.NEWS_DATA_FILE, 'r', encoding='utf-8') as f:
                    news_data = json.load(f)
            else:
                print("[!] No news data found to analyze.")
                return []
        
        total_articles = len(news_data)
        print(f"[*] Starting Batch Analysis for {total_articles} articles...")
        start_time = time.time()
        
        # --- STAGE 1: PREPARE BATCHES ---
        # We need to map Chunk -> Article ID (index) to reassemble later
        all_chunks = []
        chunk_map = [] # Stores tuple (article_index, chunk_index_in_article)
        
        print("    -> Preparing text chunks...")
        for idx, article in enumerate(news_data):
            title = article.get('title', 'Unknown')
            text = article.get('clean_text', '')
            
            chunks = self.prepare_chunks(title, text)
            
            for chunk_idx, chunk in enumerate(chunks):
                all_chunks.append(chunk)
                chunk_map.append(idx)
        
        total_chunks = len(all_chunks)
        print(f"    -> Generated {total_chunks} chunks from {total_articles} articles.")
        
        # --- STAGE 2: BATCH INFERENCE ---
        print(f"    -> Running Inference (Batch Size: 8, Device: {self.device})...")
        
        # Run pipeline on list of strings
        # Using tqdm for progress bar
        batch_results = []
        batch_size = 8
        
        # Process in batches manually 
        for i in tqdm(range(0, total_chunks, batch_size), desc="    Inference Progress"):
            batch_slice = all_chunks[i : i + batch_size]
            results = self.classifier(
                batch_slice, 
                config.SENTIMENT_LABELS, 
                multi_label=False,
                hypothesis_template=config.HYPOTHESIS_TEMPLATE,
                batch_size=batch_size
            )
            # Pipeline returns a list if input is a list, or single dict if single input.
            if isinstance(results, dict): results = [results]
            batch_results.extend(results)

        # --- STAGE 3: REASSEMBLE ---
        print("    -> Reassembling results...")
        
        # Temporary storage for article results: {article_idx: [results]}
        article_results_map = {i: [] for i in range(total_articles)}
        
        for i, res in enumerate(batch_results):
            article_idx = chunk_map[i]
            article_results_map[article_idx].append({
                "label": res['labels'][0],
                "score": res['scores'][0]
            })
            
        # --- STAGE 4: AGGREGATE & ASSIGN ---
        analyzed_results = []
        
        for i, article in enumerate(news_data):
            chunk_res = article_results_map[i]
            
            if not chunk_res:
                # Fallback if no chunks (empty text)
                article['sentiment_label'] = "Netral"
                article['sentiment_score'] = 0.0
            else:
                # 1. Prioritize Strong Signals (> 0.5)
                strong_signals = [
                    r for r in chunk_res 
                    if r['label'] in ['Bullish', 'Bearish'] and r['score'] > 0.5
                ]
                
                if strong_signals:
                    best = max(strong_signals, key=lambda x: x['score'])
                    final_label = best['label']
                    final_score = best['score']
                else:
                    # 2. Fallback to highest confidence
                    best = max(chunk_res, key=lambda x: x['score'])
                    final_label = best['label']
                    final_score = best['score']
            
            article['sentiment_label'] = final_label
            article['sentiment_score'] = final_score
            analyzed_results.append(article)

        # Save results using the global DateTimeEncoder
        with open(config.ANALYZED_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(analyzed_results, f, indent=4, ensure_ascii=False, cls=DateTimeEncoder)
            
        elapsed = time.time() - start_time
        print(f"[*] Analysis complete in {elapsed:.2f}s.")
        print(f"[*] Results saved to {config.ANALYZED_DATA_FILE}")
        
        return analyzed_results
