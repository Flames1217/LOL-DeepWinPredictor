"""Train the BiLSTM model from a local JSON/JSONL/CSV dataset.

Provide training data through TRAIN_DATA_PATH or pass the file path as the
first CLI argument.
"""

from __future__ import annotations

import os
import sys

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from BILSTM_Att.BILSTM_Att import BiLSTMModelWithAttention, LOLDataset
from BILSTM_Att.data_io import load_vector_dataset
from tool_utils.log_utils import RichLogger

rich_logger = RichLogger()


def train(dataset_path: str, output_path: str = "BILSTM_Att_best.pt") -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.manual_seed(42)

    all_data = load_vector_dataset(dataset_path)
    np.random.shuffle(all_data)

    train_size = int(0.8 * len(all_data))
    train_data = all_data[:train_size]
    valid_data = all_data[train_size:]
    if len(train_data) == 0 or len(valid_data) == 0:
        raise ValueError("Dataset must contain enough rows for train/validation split")

    train_loader = DataLoader(LOLDataset(train_data), batch_size=512, shuffle=True)
    valid_loader = DataLoader(LOLDataset(valid_data), batch_size=512, shuffle=False)

    input_size = all_data.shape[1] - 1
    model = BiLSTMModelWithAttention(input_size, hidden_size=1024, num_layers=2, output_size=1).to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.0001)

    rich_logger.info(f"Training BiLSTM from {dataset_path}")
    for epoch in tqdm(range(int(os.getenv("TRAIN_EPOCHS", "1000")))):
        model.train()
        epoch_loss = 0.0
        for x_batch, y_batch in train_loader:
            x_batch, y_batch = x_batch.to(device), y_batch.to(device)
            optimizer.zero_grad()
            loss = criterion(model(x_batch), y_batch)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()

        if (epoch + 1) % 10 == 0:
            model.eval()
            valid_loss = 0.0
            with torch.no_grad():
                for x_batch, y_batch in valid_loader:
                    x_batch, y_batch = x_batch.to(device), y_batch.to(device)
                    valid_loss += criterion(model(x_batch), y_batch).item()
            rich_logger.info(
                f"Epoch {epoch + 1}: train_loss={epoch_loss / len(train_loader):.4f}, "
                f"valid_loss={valid_loss / len(valid_loader):.4f}"
            )

    torch.save(model.state_dict(), output_path)
    rich_logger.info(f"Training complete, model saved to {output_path}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else os.getenv("TRAIN_DATA_PATH")
    if not path:
        raise SystemExit("Usage: python -m BILSTM_Att.train <dataset.json|jsonl|csv>")
    train(path, os.getenv("TRAIN_OUTPUT_PATH", "BILSTM_Att_best.pt"))
